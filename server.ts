import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = 3000;

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
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
