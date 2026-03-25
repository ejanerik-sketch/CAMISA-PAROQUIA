import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = 3000;

const SUPABASE_URL = process.env.SUPABASE_URL || "https://gjyqiaeuumnflzeftwgb.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Initialize Supabase Admin Client
const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Admin: Create User
app.post('/api/admin/create-user', async (req, res) => {
  const { name, email, password, role } = req.body;
  const authHeader = req.headers.authorization;

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase Admin Client not configured. Please set SUPABASE_SERVICE_ROLE_KEY.' });
  }

  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Verify the admin's token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: adminUser }, error: adminError } = await supabaseAdmin.auth.getUser(token);

    if (adminError || !adminUser) {
      return res.status(401).json({ error: 'Invalid admin session' });
    }

    // Check if the user is an admin in the public users table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', adminUser.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create users' });
    }

    // Create user in Auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: password,
      email_confirm: true,
      user_metadata: { name, role }
    });

    if (createError) throw createError;

    // Insert into public users table (if trigger doesn't exist or to be sure)
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: newUser.user.id,
        name,
        email: email.toLowerCase(),
        role
      });

    if (insertError) throw insertError;

    res.json({ success: true, user: newUser.user });
  } catch (error: any) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message || 'Failed to create user' });
  }
});

// Admin: Delete User
app.delete('/api/admin/delete-user/:id', async (req, res) => {
  const { id } = req.params;
  const authHeader = req.headers.authorization;

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase Admin Client not configured.' });
  }

  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: adminUser }, error: adminError } = await supabaseAdmin.auth.getUser(token);

    if (adminError || !adminUser) {
      return res.status(401).json({ error: 'Invalid admin session' });
    }

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', adminUser.id)
      .single();

    if (profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete users' });
    }

    // Delete from Auth
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (deleteAuthError) throw deleteAuthError;

    // Delete from public table
    const { error: deleteTableError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', id);
    
    if (deleteTableError) throw deleteTableError;

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message || 'Failed to delete user' });
  }
});

// Admin: Check Database Tables
app.get('/api/admin/check-db', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!supabaseAdmin) return res.status(500).json({ error: 'Admin Client not configured' });
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const results = {
      users: false,
      orders: false,
      order_items: false
    };

    // Check users table
    const { error: errUsers } = await supabaseAdmin.from('users').select('id').limit(1);
    results.users = !errUsers;

    // Check orders table
    const { error: errOrders } = await supabaseAdmin.from('orders').select('id').limit(1);
    results.orders = !errOrders;

    // Check order_items table
    const { error: errItems } = await supabaseAdmin.from('order_items').select('id').limit(1);
    results.order_items = !errItems;

    res.json({ success: true, tables: results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/send-welcome-email', async (req, res) => {
  const { name, email, password } = req.body;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('--- SIMULAÇÃO DE E-MAIL (Credenciais SMTP não configuradas) ---');
    console.log(`Para: ${email}`);
    console.log(`Assunto: Acesso ao Sistema - Padroeira 2026`);
    console.log(`Olá ${name}, seu acesso foi criado. Senha: ${password}`);
    console.log('--------------------------------------------------------------');
    return res.json({ success: true, simulated: true });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Paróquia Nossa Senhora de Fátima" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Acesso ao Sistema - Padroeira 2026`,
      html: `
        <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto;">
          <h2 style="color: #1e3a8a;">Olá, ${name}!</h2>
          <p>Seu acesso ao sistema de pedidos da Festa da Padroeira 2026 foi criado com sucesso.</p>
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>E-mail:</strong> ${email}</p>
            <p style="margin: 0;"><strong>Senha Temporária:</strong> ${password}</p>
          </div>
          <p>Recomendamos que você altere sua senha no primeiro acesso utilizando a opção "Esqueci minha senha".</p>
          <p>Atenciosamente,<br>Equipe Paróquia Nossa Senhora de Fátima</p>
        </div>
      `
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    res.status(500).json({ error: 'Falha ao enviar email' });
  }
});

// Send Email
app.post('/api/send-order-email', async (req, res) => {
  const { order, pdfDataUri } = req.body;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('--- SIMULAÇÃO DE E-MAIL (Credenciais SMTP não configuradas) ---');
    console.log(`Para: ejanerik@gmail.com`);
    console.log(`Assunto: Novo Pedido #${order.orderNumber} - ${order.customer.name}`);
    console.log(`Anexo: Pedido_${order.orderNumber}.pdf`);
    console.log('--------------------------------------------------------------');
    return res.json({ success: true, simulated: true });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const itemsList = order.items.map((i: any) => `- ${i.quantity}x ${i.name} (R$ ${(i.price * i.quantity).toFixed(2)})`).join('\n');

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: 'ejanerik@gmail.com',
      subject: `Novo Pedido #${order.orderNumber} - ${order.customer.name}`,
      text: `Um novo pedido foi realizado!\n\nDetalhes do Pedido:\nNúmero: ${order.orderNumber}\nCliente: ${order.customer.name}\nWhatsApp: ${order.customer.whatsapp}\nEndereço: ${order.customer.address}\nGrupo: ${order.customer.group || 'N/A'}\n\nItens:\n${itemsList}\n\nTotal: R$ ${order.total.toFixed(2)}\n\nO PDF do pedido está em anexo.`,
      attachments: [
        {
          filename: `Pedido_${order.orderNumber}.pdf`,
          path: pdfDataUri
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    res.status(500).json({ error: 'Falha ao enviar e-mail' });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
