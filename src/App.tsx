import React, { useState, useEffect } from 'react';
import { ShoppingCart, User, CheckCircle, Plus, Minus, ArrowLeft, FileText, MapPin, Phone, Users, Download, Edit2, Send, Lock, LogOut, UserPlus, Trash2, Copy, CreditCard, AlertCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { db, auth, secondaryAuth } from './firebase';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, orderBy, getDoc, limit, onSnapshot, where } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

const SIZES = [
  { id: 'PP_BABY', name: 'PP BABY', price: 40 },
  { id: 'P_BABY', name: 'P BABY', price: 40 },
  { id: 'M_BABY', name: 'M BABY', price: 40 },
  { id: 'G_BABY', name: 'G BABY', price: 40 },
  { id: 'GG_BABY', name: 'GG BABY', price: 40 },
  { id: 'PP_TRAD', name: 'PP TRAD', price: 40 },
  { id: 'P_TRAD', name: 'P TRAD', price: 40 },
  { id: 'M_TRAD', name: 'M TRAD', price: 40 },
  { id: 'G_TRAD', name: 'G TRAD', price: 40 },
  { id: 'GG_TRAD', name: 'GG TRAD', price: 40 },
  { id: 'EXG_1', name: 'G1', price: 50 },
  { id: 'EXG_2', name: 'G2', price: 50 },
  { id: 'EXG_3', name: 'G3', price: 50 },
  { id: 'EXG_4', name: 'G4', price: 60 },
  { id: 'EXG_5', name: 'G5', price: 60 },
  { id: '2_ANOS', name: '2 ANOS', price: 35 },
  { id: '4_ANOS', name: '4 ANOS', price: 35 },
  { id: '6_ANOS', name: '6 ANOS', price: 35 },
  { id: '8_ANOS', name: '8 ANOS', price: 35 },
  { id: '10_ANOS', name: '10 ANOS', price: 35 },
  { id: '12_ANOS', name: '12 ANOS', price: 35 },
  { id: '14_ANOS', name: '14 ANOS', price: 35 },
];

const SIZE_GROUPS = [
  {
    title: 'Baby Look (R$ 40,00)',
    sizes: SIZES.filter(s => s.id.includes('BABY'))
  },
  {
    title: 'Tradicional (R$ 40,00)',
    sizes: SIZES.filter(s => s.id.includes('TRAD'))
  },
  {
    title: 'Infantil (R$ 35,00)',
    sizes: SIZES.filter(s => s.id.includes('ANOS'))
  },
  {
    title: 'Tamanhos Especiais (G1 a G3: R$ 50,00 | G4 e G5: R$ 60,00)',
    sizes: SIZES.filter(s => s.id.includes('EXG'))
  }
];

interface OrderItem {
  sizeId: string;
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  orderNumber: string;
  date: string;
  customer: {
    name: string;
    whatsapp: string;
    address: string;
    group: string;
  };
  items: OrderItem[];
  total: number;
  createdBy?: {
    id: string;
    name: string;
  };
}

const getOrders = async (user: any): Promise<Order[]> => {
  try {
    let q;
    if (user?.role === 'admin') {
      q = query(collection(db, 'orders'), orderBy('date', 'desc'));
    } else if (user) {
      q = query(collection(db, 'orders'), where('createdBy.id', '==', user.id), orderBy('date', 'desc'));
    } else {
      return [];
    }
    
    const snapshot = await getDocs(q);
    const orders: Order[] = [];
    
    for (const docSnap of snapshot.docs) {
      const d = docSnap.data();
      let createdBy = undefined;
      
      if (d.created_by) {
        try {
          const userDoc = await getDoc(doc(db, 'users', d.created_by));
          if (userDoc.exists()) {
            createdBy = { id: userDoc.id, name: userDoc.data().name };
          }
        } catch (e) {
          console.error('Erro ao buscar usuário do pedido:', e);
        }
      } else if (d.createdBy) {
         createdBy = d.createdBy;
      }
      
      orders.push({
        id: docSnap.id,
        orderNumber: d.order_number || d.orderNumber,
        date: d.date,
        customer: d.customer,
        items: d.items,
        total: d.total,
        createdBy
      });
    }
    return orders;
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error);
    return [];
  }
};

const saveOrder = async (order: Order, isEdit: boolean = false) => {
  const payload: any = {
    orderNumber: order.orderNumber,
    date: order.date,
    customer: order.customer,
    items: order.items,
    total: order.total
  };

  if (order.createdBy) {
    payload.createdBy = order.createdBy;
  }

  try {
    if (isEdit) {
      await updateDoc(doc(db, 'orders', order.id), payload);
    } else {
      await setDoc(doc(db, 'orders', order.id), payload);
    }
  } catch (error) {
    console.error('Erro ao salvar pedido:', error);
    throw error;
  }
};

const generateOrderNumber = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'orders'));
    const count = snapshot.size;
    const nextNum = count + 1;
    return `NSF26-${nextNum.toString().padStart(4, '0')}`;
  } catch (error: any) {
    if (error.code !== 'permission-denied') {
      console.error('Erro ao gerar número do pedido:', error);
    }
    return `NSF26-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  }
};

export const generateOrderPDF = (order: Order) => {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text('Camisas Festa de Nossa Senhora de Fátima 2026', 14, 20);
  doc.setFontSize(12);
  doc.text(`Pedido: ${order.orderNumber}`, 14, 30);
  doc.text(`Data: ${new Date(order.date).toLocaleString('pt-BR')}`, 14, 38);
  doc.text(`Nome: ${order.customer.name}`, 14, 46);
  doc.text(`WhatsApp: ${order.customer.whatsapp}`, 14, 54);
  doc.text(`Endereço: ${order.customer.address}`, 14, 62);
  doc.text(`Grupo/Pastoral: ${order.customer.group || 'N/A'}`, 14, 70);

  const tableData = order.items.map(item => [
    item.name,
    item.quantity.toString(),
    `R$ ${item.price.toFixed(2)}`,
    `R$ ${(item.quantity * item.price).toFixed(2)}`
  ]);

  autoTable(doc, {
    startY: 80,
    head: [['Item', 'Qtd', 'Preço Unit.', 'Subtotal']],
    body: tableData,
    foot: [['', '', 'Total', `R$ ${order.total.toFixed(2)}`]],
  });

  return doc;
};

export const sendWhatsApp = (order: Order) => {
  const text = `*Camisas Festa de Nossa Senhora de Fátima 2026*
  
*Pedido:* ${order.orderNumber}
*Nome:* ${order.customer.name}
*WhatsApp:* ${order.customer.whatsapp}
*Endereço:* ${order.customer.address}
*Grupo:* ${order.customer.group || 'N/A'}

*ITENS:*
${order.items.map(i => `- ${i.quantity}x ${i.name} (R$ ${(i.price * i.quantity).toFixed(2)})`).join('\n')}

*TOTAL:* R$ ${order.total.toFixed(2)}

*PAGAMENTO:*
Segue o PIX para o pagamento das camisas:
PIX CNPJ
35701356000137 

Nome de: CINTIA VIEIRA SANTOS

Ao fazer o pagamento, enviar o comprovante neste mesmo WhatsApp.

_Deus abençoe!_`;

  const encodedText = encodeURIComponent(text);
  window.open(`https://wa.me/5573988030447?text=${encodedText}`, '_blank');
};

function OrderForm({ onSubmit, initialOrder, user }: { onSubmit: (order: Order) => void, initialOrder?: Order | null, user?: any }) {
  const [formData, setFormData] = useState({
    name: '',
    whatsapp: '',
    address: '',
    group: ''
  });

  const [items, setItems] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  useEffect(() => {
    if (initialOrder) {
      setFormData(initialOrder.customer);
      const initialItems: Record<string, number> = {};
      initialOrder.items.forEach(item => {
        initialItems[item.sizeId] = item.quantity;
      });
      setItems(initialItems);
    } else {
      setFormData({ name: '', whatsapp: '', address: '', group: '' });
      setItems({});
    }
  }, [initialOrder]);

  const handleQuantityChange = (sizeId: string, delta: number) => {
    setItems(prev => {
      const current = prev[sizeId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [sizeId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [sizeId]: next };
    });
  };

  const totalItems = Object.values(items).reduce((a: number, b: number) => a + b, 0);
  const totalPrice = Object.entries(items).reduce((total: number, [sizeId, qty]) => {
    const size = SIZES.find(s => s.id === sizeId);
    return total + (size?.price || 0) * (qty as number);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalItems === 0) {
      alert('Selecione pelo menos uma camisa para fazer o pedido.');
      return;
    }

    if (!initialOrder && !showDuplicateWarning) {
      try {
        const snapshot = await getDocs(collection(db, 'orders'));
        const existingOrders = snapshot.docs.map(doc => doc.data());
        
        const isDuplicate = existingOrders.some((o: any) => 
          o.customer?.name?.toLowerCase().trim() === formData.name.toLowerCase().trim() && 
          o.customer?.whatsapp?.replace(/\D/g, '') === formData.whatsapp.replace(/\D/g, '')
        );
        
        if (isDuplicate) {
          setShowDuplicateWarning(true);
          return;
        }
      } catch (err: any) {
        if (err.code !== 'permission-denied') {
          console.error('Erro ao verificar duplicidade:', err);
        }
      }
    }

    setIsSubmitting(true);

    const orderItems = Object.entries(items).map(([sizeId, quantity]) => ({
      sizeId,
      quantity: quantity as number,
      price: SIZES.find(s => s.id === sizeId)?.price || 0,
      name: SIZES.find(s => s.id === sizeId)?.name || ''
    }));

    const orderNum = initialOrder ? initialOrder.orderNumber : await generateOrderNumber();

    const newOrder: Order = {
      id: initialOrder ? initialOrder.id : crypto.randomUUID(),
      orderNumber: orderNum,
      date: initialOrder ? initialOrder.date : new Date().toISOString(),
      customer: formData,
      items: orderItems,
      total: totalPrice,
      createdBy: initialOrder ? initialOrder.createdBy : (user ? { id: user.id, name: user.name } : undefined)
    };

    try {
      await saveOrder(newOrder, !!initialOrder);

      if (!initialOrder) {
        // --- INTEGRAÇÃO GOOGLE SHEETS ---
        const sheetsUrl = (import.meta as any).env.VITE_GOOGLE_SHEETS_WEBHOOK_URL || "https://script.google.com/macros/s/AKfycbzD409OB_SVIAGwiJreL5Ca8YsHgzWFNTqV10bJXa17fVqU2xOTHQN_RAVpwu7C_y8bHA/exec";
        if (sheetsUrl) {
          const individualShirts: string[] = [];
          newOrder.items.forEach(item => {
            for (let i = 0; i < item.quantity; i++) {
              individualShirts.push(item.name);
            }
          });

          const sheetsPayload = {
            orderNumber: newOrder.orderNumber,
            date: new Date(newOrder.date).toLocaleString('pt-BR'),
            whatsapp: newOrder.customer.whatsapp,
            name: newOrder.customer.name,
            camisa1: individualShirts[0] || "",
            camisa2: individualShirts[1] || "",
            camisa3: individualShirts[2] || "",
            camisa4: individualShirts[3] || "",
            camisa5: individualShirts[4] || "",
            camisa6: individualShirts[5] || "",
            paymentMethod: "PIX",
            sellerName: newOrder.createdBy?.name || "Site"
          };

          const formData = new URLSearchParams();
          Object.entries(sheetsPayload).forEach(([key, value]) => {
            formData.append(key, value as string);
          });

          try {
            await fetch(sheetsUrl, {
              method: 'POST',
              mode: 'no-cors',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: formData.toString()
            });
          } catch (err) {
            console.error('Erro ao enviar para o Google Sheets:', err);
          }
        }
        // --------------------------------

        const doc = generateOrderPDF(newOrder);
        const pdfDataUri = doc.output('datauristring');
        
        try {
          await fetch('/api/send-order-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: newOrder, pdfDataUri })
          });
        } catch (err) {
          console.error('Erro ao enviar email:', err);
        }
        
        sendWhatsApp(newOrder);
      }

      setIsSubmitting(false);
      onSubmit(newOrder);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar pedido: ' + (err.message || 'Erro desconhecido.'));
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 pb-24">
      {showDuplicateWarning && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-800 mb-6">
          <AlertCircle className="shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-bold mb-1">Atenção: Pedido Duplicado?</p>
            <p className="text-sm mb-3">Já existe um pedido registrado com este mesmo nome e WhatsApp. Você tem certeza que deseja fazer um novo pedido?</p>
            <div className="flex gap-3">
              <button 
                type="button"
                onClick={() => setShowDuplicateWarning(false)}
                className="px-3 py-1.5 bg-white border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={(e) => handleSubmit(e)}
                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Sim, confirmar novo pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      {!initialOrder && (
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
          <h3 className="text-xl font-bold text-blue-900 mb-5 flex items-center gap-2">
            <FileText className="text-blue-500" size={24} /> Como fazer seu pedido
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0">1</div>
              <div>
                <h4 className="font-bold text-slate-800 mb-1">Tire suas medidas</h4>
                <p className="text-sm text-slate-600">Recomendamos que tire as medidas das camisas durante as missas antes de realizar o pedido por aqui.</p>
              </div>
            </div>
            
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0">2</div>
              <div>
                <h4 className="font-bold text-slate-800 mb-1">Preencha seus dados</h4>
                <p className="text-sm text-slate-600">Informe seu nome, WhatsApp, endereço e, se participar, seu grupo ou pastoral.</p>
              </div>
            </div>
            
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0">3</div>
              <div>
                <h4 className="font-bold text-slate-800 mb-1">Escolha os tamanhos</h4>
                <p className="text-sm text-slate-600">Selecione as quantidades e tamanhos desejados. O valor total será calculado automaticamente.</p>
              </div>
            </div>
            
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0">4</div>
              <div>
                <h4 className="font-bold text-slate-800 mb-1">Finalize e pague</h4>
                <p className="text-sm text-slate-600">Ao finalizar, você será direcionado ao WhatsApp para enviar o pedido e o comprovante do PIX.</p>
              </div>
            </div>
          </div>
          
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-amber-800">
            <span className="text-2xl">⚠️</span>
            <p className="text-sm font-medium"><strong>Atenção:</strong> O seu pedido só será validado e produzido após a confirmação do pagamento via PIX.</p>
          </div>
        </section>
      )}

      {/* Customer Info */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
          <User className="text-amber-500" /> Dados do Comprador
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
              Nome Completo
            </label>
            <input required type="text" className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-slate-50" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="João da Silva" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
              <Phone size={14} className="text-slate-400" /> WhatsApp
            </label>
            <input required type="tel" className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-slate-50" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} placeholder="(00) 00000-0000" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
              <MapPin size={14} className="text-slate-400" /> Endereço Completo
            </label>
            <input required type="text" className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-slate-50" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Rua, Número, Bairro, Complemento" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
              <Users size={14} className="text-slate-400" /> Grupo / Movimento / Pastoral (Opcional)
            </label>
            <input type="text" className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-slate-50" value={formData.group} onChange={e => setFormData({...formData, group: e.target.value})} placeholder="Ex: Terço dos Homens, EJC, ECC, etc." />
          </div>
        </div>
      </section>

      {/* Sizes */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold text-blue-900 mb-6 flex items-center gap-2">
          <ShoppingCart className="text-amber-500" /> Pedido de Camisas
        </h2>
        
        <div className="space-y-8">
          {SIZE_GROUPS.map(group => (
            <div key={group.title}>
              <h3 className="text-md font-semibold text-sky-800 mb-4 border-b border-sky-100 pb-2">{group.title}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {group.sizes.map(size => {
                  const qty = items[size.id] || 0;
                  return (
                    <div key={size.id} className={`p-3 rounded-xl border ${qty > 0 ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-slate-50'} flex flex-col items-center transition-colors`}>
                      <span className="font-bold text-slate-800 text-sm mb-1">{size.name}</span>
                      <span className="text-xs text-slate-500 mb-3">R$ {size.price.toFixed(2)}</span>
                      <div className="flex items-center gap-3 bg-white rounded-lg border border-slate-200 p-1 shadow-sm w-full justify-between">
                        <button type="button" onClick={() => handleQuantityChange(size.id, -1)} className="w-8 h-8 flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors" disabled={qty === 0}>
                          <Minus size={16} />
                        </button>
                        <span className="w-4 text-center font-bold text-blue-900">{qty}</span>
                        <button type="button" onClick={() => handleQuantityChange(size.id, 1)} className="w-8 h-8 flex items-center justify-center rounded-md text-blue-600 hover:bg-blue-100 transition-colors">
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Summary & Submit - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-blue-900 text-white p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] border-t border-blue-800 z-20">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-blue-200 text-xs uppercase tracking-wider font-semibold mb-1">Total de Peças</p>
              <p className="text-xl font-bold text-white">{totalItems}</p>
            </div>
            <div className="h-8 w-px bg-blue-700"></div>
            <div>
              <p className="text-blue-200 text-xs uppercase tracking-wider font-semibold mb-1">Valor Total</p>
              <p className="text-2xl font-bold text-amber-400">R$ {totalPrice.toFixed(2)}</p>
            </div>
          </div>
          <button disabled={isSubmitting} type="submit" className="w-full sm:w-auto bg-amber-400 hover:bg-amber-500 text-blue-950 font-bold py-3 px-8 rounded-xl transition-colors shadow-md flex items-center justify-center gap-2 text-lg disabled:opacity-70">
            <CheckCircle size={20} />
            {isSubmitting ? 'Processando...' : (initialOrder ? 'Atualizar Pedido' : 'Finalizar Pedido')}
          </button>
        </div>
      </div>
    </form>
  );
}

function SuccessView({ order, onNewOrder }: { order: Order, onNewOrder: () => void }) {
  const date = new Date(order.date);
  const formattedDate = date.toLocaleDateString('pt-BR');
  const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 text-center max-w-lg mx-auto mt-8">
      <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle size={40} />
      </div>
      <h2 className="text-2xl font-bold text-blue-900 mb-2">Pedido Salvo com Sucesso!</h2>
      <p className="text-slate-600 mb-8">Sua encomenda foi registrada e o número do seu pedido foi gerado.</p>

      <div className="bg-slate-50 rounded-2xl p-6 text-left mb-8 border border-slate-200">
        <div className="flex justify-between items-center border-b border-slate-200 pb-4 mb-4">
          <span className="text-slate-500 font-medium">Número do Pedido</span>
          <span className="font-bold text-xl text-blue-900 bg-blue-100 px-3 py-1 rounded-lg">{order.orderNumber}</span>
        </div>
        <div className="flex justify-between items-center border-b border-slate-200 pb-4 mb-4">
          <span className="text-slate-500 font-medium">Data e Hora</span>
          <span className="font-medium text-slate-800">{formattedDate} às {formattedTime}</span>
        </div>
        <div className="flex justify-between items-center border-b border-slate-200 pb-4 mb-4">
          <span className="text-slate-500 font-medium">Comprador</span>
          <span className="font-medium text-slate-800">{order.customer.name}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-500 font-medium">Valor Total</span>
          <span className="font-bold text-2xl text-amber-500">R$ {order.total.toFixed(2)}</span>
        </div>
      </div>

      <div className="bg-amber-50 rounded-2xl p-6 text-left mb-8 border border-amber-200">
        <h3 className="font-bold text-amber-900 mb-2 flex items-center gap-2">
          <CreditCard size={20} /> Pagamento via PIX
        </h3>
        <p className="text-sm text-amber-800 mb-4">
          Para confirmar seu pedido, realize o pagamento via PIX para a chave abaixo:
        </p>
        <div className="bg-white p-4 rounded-xl border border-amber-200 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 uppercase font-bold">Chave PIX (CNPJ)</span>
            <span className="font-mono font-bold text-slate-800">35701356000137</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 uppercase font-bold">Nome</span>
            <span className="font-bold text-slate-800 text-right text-sm">CINTIA VIEIRA SANTOS</span>
          </div>
          <button 
            onClick={() => {
              navigator.clipboard.writeText('35701356000137');
              alert('Chave PIX copiada!');
            }}
            className="mt-2 w-full py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Copy size={18} /> Copiar Chave PIX
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 mt-6">
        <button onClick={() => sendWhatsApp(order)} className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors">
          <Send size={20} /> Enviar para WhatsApp
        </button>
        <button onClick={() => generateOrderPDF(order).save(`Pedido_${order.orderNumber}.pdf`)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors">
          <Download size={20} /> Baixar PDF do Pedido
        </button>
        <button onClick={onNewOrder} className="text-blue-600 font-bold hover:text-blue-800 transition-colors flex items-center justify-center gap-2 w-full p-3 rounded-xl hover:bg-blue-50 mt-2">
          <Plus size={20} /> Fazer novo pedido
        </button>
      </div>
    </div>
  );
}

function LoginView({ onLogin, onBack }: { onLogin: (user: any) => void, onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const authUser = userCredential.user;
      
      const userDoc = await getDoc(doc(db, 'users', authUser.uid));
      if (userDoc.exists()) {
        onLogin({ id: userDoc.id, ...userDoc.data() });
      } else {
        if (email.toLowerCase() === 'ejanerik@gmail.com') {
          const newAdmin = { name: 'Administrador Geral', email: email.toLowerCase(), role: 'admin' };
          await setDoc(doc(db, 'users', authUser.uid), newAdmin);
          onLogin({ id: authUser.uid, ...newAdmin });
        } else {
          setError('Usuário não possui perfil de acesso. Contate o administrador.');
          await signOut(auth);
        }
      }
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        if (email.toLowerCase() === 'ejanerik@gmail.com') {
          try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const authUser = userCredential.user;
            const newAdmin = { name: 'Administrador Geral', email: email.toLowerCase(), role: 'admin' };
            await setDoc(doc(db, 'users', authUser.uid), newAdmin);
            onLogin({ id: authUser.uid, ...newAdmin });
          } catch (signUpErr: any) {
            setError('Erro ao criar conta do administrador geral: ' + signUpErr.message);
          }
        } else {
          setError('E-mail ou senha incorretos');
        }
      } else {
        setError(err.message || 'Erro de conexão com o banco de dados');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 bg-white rounded-full shadow-sm text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors border border-slate-200">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
          <Lock size={24} className="text-amber-500" /> Acesso Restrito
        </h2>
      </div>
      
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-6 text-sm border border-red-100">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="admin@paroquia.com" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
          <input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="••••••••" />
        </div>
        <button disabled={loading} type="submit" className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 px-4 rounded-xl transition-colors mt-4 disabled:opacity-70">
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

function UsersView({ user, onBack }: { user: any, onBack: () => void }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'user' });

  const fetchUsers = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
      const authUser = userCredential.user;

      await setDoc(doc(db, 'users', authUser.uid), {
        name: formData.name,
        email: formData.email,
        role: formData.role
      });

      await signOut(secondaryAuth);

      setShowForm(false);
      setFormData({ name: '', email: '', password: '', role: 'user' });
      fetchUsers();
      alert('Usuário cadastrado com sucesso na Autenticação e no Banco!');
    } catch (err: any) {
      alert('Erro ao criar usuário: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    try {
      await deleteDoc(doc(db, 'users', id));
      fetchUsers();
    } catch (err: any) {
      alert('Erro ao excluir usuário: ' + err.message);
    }
  };

  if (loading) return <div className="text-center p-8">Carregando usuários...</div>;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-white rounded-full shadow-sm text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors border border-slate-200">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-2xl font-bold text-blue-900">Gerenciar Usuários</h2>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-amber-400 hover:bg-amber-500 text-blue-900 font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-colors">
          <UserPlus size={18} /> Novo Usuário
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
          <h3 className="text-lg font-bold text-blue-900 mb-4">Cadastrar Novo Usuário</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
              <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
              <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
              <input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full p-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nível de Acesso</label>
              <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full p-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                <option value="user">Usuário Comum (Apenas Relatórios)</option>
                <option value="admin">Administrador (Relatórios e Usuários)</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
            <button type="submit" className="bg-blue-900 hover:bg-blue-800 text-white font-bold py-2 px-6 rounded-xl transition-colors">Salvar</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="p-4 font-semibold">Nome</th>
              <th className="p-4 font-semibold">E-mail</th>
              <th className="p-4 font-semibold">Nível</th>
              <th className="p-4 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 font-medium text-slate-800">{u.name}</td>
                <td className="p-4 text-slate-600">{u.email}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-md text-xs font-bold ${u.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                    {u.role === 'admin' ? 'Admin' : 'Usuário'}
                  </span>
                </td>
                <td className="p-4">
                  <button onClick={() => handleDelete(u.id)} className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors" title="Excluir Usuário">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportView({ onBack, onEdit, user, onManageUsers }: { onBack: () => void, onEdit: (order: Order) => void, user: any, onManageUsers: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filterName, setFilterName] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterUser, setFilterUser] = useState('all');
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);

  useEffect(() => {
    const loadOrders = async () => {
      const fetchedOrders = await getOrders(user);
      setOrders(fetchedOrders);
    };
    loadOrders();
  }, [user]);

  const uniqueUsers = Array.from(new Set(orders.map(o => o.createdBy?.name).filter(Boolean)));

  const filteredOrders = orders.filter(o => {
    const matchName = o.customer.name.toLowerCase().includes(filterName.toLowerCase());
    
    const orderDate = new Date(o.date);
    let matchDate = true;
    if (filterStartDate) {
      matchDate = matchDate && orderDate >= new Date(filterStartDate + 'T00:00:00');
    }
    if (filterEndDate) {
      matchDate = matchDate && orderDate <= new Date(filterEndDate + 'T23:59:59');
    }

    let matchUser = true;
    if (filterUser === 'direct') {
      matchUser = !o.createdBy;
    } else if (filterUser === 'internal') {
      matchUser = !!o.createdBy;
    } else if (filterUser !== 'all') {
      matchUser = o.createdBy?.name === filterUser;
    }
    return matchName && matchDate && matchUser;
  });

  const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.total, 0);
  const totalShirts = filteredOrders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);

  const shirtsBySize = filteredOrders.reduce((acc, order) => {
    order.items.forEach(item => {
      acc[item.name] = (acc[item.name] || 0) + item.quantity;
    });
    return acc;
  }, {} as Record<string, number>);

  const salesByDate = filteredOrders.reduce((acc, order) => {
    const dateStr = new Date(order.date).toLocaleDateString('pt-BR');
    if (!acc[dateStr]) {
      acc[dateStr] = { date: dateStr, total: 0, count: 0 };
    }
    acc[dateStr].total += order.total;
    acc[dateStr].count += 1;
    return acc;
  }, {} as Record<string, { date: string, total: number, count: number }>);

  const chartData = Object.values(salesByDate).sort((a: any, b: any) => {
    const [d1, m1, y1] = a.date.split('/');
    const [d2, m2, y2] = b.date.split('/');
    return new Date(`${y1}-${m1}-${d1}`).getTime() - new Date(`${y2}-${m2}-${d2}`).getTime();
  });

  const exportReportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Camisas Festa de Nossa Senhora de Fátima 2026', 14, 20);
    
    doc.setFontSize(12);
    let yPos = 30;
    if (filterStartDate || filterEndDate) {
      const start = filterStartDate ? new Date(filterStartDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Início';
      const end = filterEndDate ? new Date(filterEndDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Hoje';
      doc.text(`Período: ${start} até ${end}`, 14, yPos);
      yPos += 10;
    }

    doc.text(`Total de Camisas Vendidas: ${totalShirts}`, 14, yPos);
    yPos += 8;
    doc.text(`Valor Total Vendido: R$ ${totalRevenue.toFixed(2)}`, 14, yPos);
    yPos += 12;

    doc.setFontSize(14);
    doc.text('Resumo por Tamanho:', 14, yPos);
    yPos += 8;
    doc.setFontSize(12);
    
    const sizeEntries = Object.entries(shirtsBySize).sort((a: any, b: any) => b[1] - a[1]);
    const sizeTableData = sizeEntries.map(([size, qty]) => [size, qty.toString()]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['Tamanho', 'Quantidade']],
      body: sizeTableData,
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;

    doc.setFontSize(14);
    doc.text('Lista de Pedidos:', 14, yPos);
    yPos += 8;

    const tableData = filteredOrders.map(o => [
      o.orderNumber,
      new Date(o.date).toLocaleDateString('pt-BR'),
      o.customer.name,
      o.items.reduce((acc, i) => acc + i.quantity, 0).toString(),
      `R$ ${o.total.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Pedido', 'Data', 'Cliente', 'Qtd Peças', 'Total']],
      body: tableData,
      foot: [['', '', 'Total Geral', totalShirts.toString(), `R$ ${totalRevenue.toFixed(2)}`]]
    });

    doc.save('Relatorio_Vendas.pdf');
  };

  const confirmDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'orders', id));
      setOrders(orders.filter(o => o.id !== id));
      setOrderToDelete(null);
    } catch (err: any) {
      alert('Erro ao apagar pedido: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {orderToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Apagar Pedido</h3>
            <p className="text-slate-600 mb-6">Tem certeza que deseja apagar este pedido? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setOrderToDelete(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => confirmDelete(orderToDelete)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
              >
                Apagar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-white rounded-full shadow-sm text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors border border-slate-200">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-2xl font-bold text-blue-900">Relatório de Vendas</h2>
        </div>
        {user?.role === 'admin' && (
          <button onClick={onManageUsers} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-colors text-sm">
            <Users size={16} /> Gerenciar Usuários
          </button>
        )}
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-slate-700 mb-1">Filtrar por Nome</label>
          <input type="text" className="w-full p-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none" value={filterName} onChange={e => setFilterName(e.target.value)} placeholder="Buscar cliente..." />
        </div>
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-slate-700 mb-1">Data Inicial</label>
          <input type="date" className="w-full p-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} />
        </div>
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-slate-700 mb-1">Data Final</label>
          <input type="date" className="w-full p-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} />
        </div>
        {user?.role === 'admin' && (
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-slate-700 mb-1">Origem do Pedido</label>
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="w-full p-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="all">Todos os Pedidos</option>
              <option value="direct">Direto do Fiel (Site)</option>
              <option value="internal">Equipe Interna (Todos)</option>
              {uniqueUsers.map(name => (
                <option key={name as string} value={name as string}>Equipe: {name}</option>
              ))}
            </select>
          </div>
        )}
        <button onClick={exportReportPDF} className="bg-blue-900 hover:bg-blue-800 text-white font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors w-full sm:w-auto h-[42px]">
          <Download size={18} /> Exportar PDF
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-blue-500">
          <p className="text-slate-500 text-sm font-medium mb-1">Total de Pedidos</p>
          <p className="text-3xl font-bold text-blue-900">{filteredOrders.length}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-sky-400">
          <p className="text-slate-500 text-sm font-medium mb-1">Camisas Vendidas</p>
          <p className="text-3xl font-bold text-blue-900">{totalShirts}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-amber-400">
          <p className="text-slate-500 text-sm font-medium mb-1">Receita Total</p>
          <p className="text-3xl font-bold text-amber-500">R$ {totalRevenue.toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Temperatura de Vendas por Dia</h3>
        {chartData.length === 0 ? (
          <p className="text-slate-500 text-sm">Nenhum dado para exibir no gráfico.</p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} tickFormatter={(value) => `R$ ${value}`} />
                <Tooltip 
                  cursor={{fill: '#F1F5F9'}}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'}}
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Vendas']}
                  labelStyle={{fontWeight: 'bold', color: '#0F172A', marginBottom: '4px'}}
                />
                <Bar dataKey="total" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Total de Camisas por Tamanho</h3>
        {Object.keys(shirtsBySize).length === 0 ? (
          <p className="text-slate-500 text-sm">Nenhuma camisa vendida neste filtro.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {Object.entries(shirtsBySize)
              .sort((a: any, b: any) => b[1] - a[1]) // Sort by quantity descending
              .map(([size, qty]) => (
              <div key={size} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-3">
                <span className="font-bold text-slate-700">{size}</span>
                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-md">{qty}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-4 font-semibold">Pedido</th>
                <th className="p-4 font-semibold">Data/Hora</th>
                <th className="p-4 font-semibold">Cliente</th>
                <th className="p-4 font-semibold">Itens</th>
                <th className="p-4 font-semibold">Total</th>
                <th className="p-4 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">Nenhum pedido encontrado.</td>
                </tr>
              ) : (
                filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-blue-900">{order.orderNumber}</td>
                    <td className="p-4 text-slate-600">
                      {new Date(order.date).toLocaleDateString('pt-BR')} <br/>
                      <span className="text-xs text-slate-400">{new Date(order.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-slate-800">{order.customer.name}</p>
                      <p className="text-xs text-slate-500">{order.customer.whatsapp}</p>
                      {order.createdBy ? (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-md">
                          Vendedor: {order.createdBy.name}
                        </span>
                      ) : (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-md">
                          Site (Direto)
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-slate-600 whitespace-normal min-w-[200px]">
                      <ul className="list-disc list-inside text-xs space-y-1">
                        {order.items.map((item, idx) => (
                          <li key={idx}><span className="font-semibold">{item.quantity}x</span> {item.name}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="p-4 font-bold text-slate-800">R$ {order.total.toFixed(2)}</td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        {user?.role === 'admin' || (order.createdBy && order.createdBy.id === user?.id) ? (
                          <button onClick={() => onEdit(order)} className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-100 transition-colors" title="Editar Pedido">
                            <Edit2 size={18} />
                          </button>
                        ) : null}
                        
                        {user?.role === 'admin' ? (
                          <button onClick={() => setOrderToDelete(order.id)} className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-100 transition-colors" title="Apagar Pedido">
                            <Trash2 size={18} />
                          </button>
                        ) : null}

                        {user?.role !== 'admin' && !(order.createdBy && order.createdBy.id === user?.id) && (
                          <span className="text-slate-400 text-xs italic">Sem permissão</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ModelsShowcase() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = [
    {
      image: "http://janerik.com.br/wp-content/uploads/2026/03/HOMEM-CAMISA-2026-FESTA-DA-PADROEIRA-scaled.jpg",
      title: "Modelo Tradicional"
    },
    {
      image: "http://janerik.com.br/wp-content/uploads/2026/03/CAMISA-2026-FESTA-DA-PADROEIRA-scaled.jpg",
      title: "Modelo Baby Look"
    }
  ];

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

  return (
    <div className="w-full mt-8 mb-12 relative overflow-hidden bg-slate-900">
      <div className="max-w-7xl mx-auto relative">
        <div className="relative aspect-[3/4] md:aspect-auto md:h-[800px] w-full flex items-center justify-center">
          {slides.map((slide, index) => (
            <div 
              key={index} 
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
            >
              <img 
                src={slide.image} 
                alt={slide.title} 
                className="w-full h-full object-contain md:object-cover md:object-top opacity-80" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
              <div className="absolute bottom-12 left-0 right-0 text-center">
                <h3 className="text-3xl md:text-5xl font-extrabold text-white drop-shadow-lg mb-2">{slide.title}</h3>
                <p className="text-white/80 text-lg md:text-xl font-medium">Veja como fica no corpo</p>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation Buttons */}
        <button 
          onClick={prevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 flex items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors backdrop-blur-sm"
        >
          <ArrowLeft size={24} />
        </button>
        <button 
          onClick={nextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 flex items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors backdrop-blur-sm"
        >
          <ArrowLeft size={24} className="rotate-180" />
        </button>

        {/* Dots */}
        <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center gap-3">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-3 h-3 rounded-full transition-all ${index === currentSlide ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/80'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<'form' | 'success' | 'report' | 'login' | 'users'>('form');
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  
  const [token, setToken] = useState<string | null>(localStorage.getItem('nsf_token'));
  const [user, setUser] = useState<any>(JSON.parse(localStorage.getItem('nsf_user') || 'null'));
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', authUser.uid));
          if (userDoc.exists()) {
            const userData = { id: userDoc.id, ...userDoc.data() };
            setUser(userData);
            localStorage.setItem('nsf_user', JSON.stringify(userData));
          }
        } catch (error) {
          console.error('Erro ao buscar dados do usuário:', error);
        }
      } else {
        setUser(null);
        localStorage.removeItem('nsf_user');
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        await getDocs(query(collection(db, 'users'), limit(1)));
        console.log('Conexão com as tabelas do Firebase verificada com sucesso!');
      } catch (error: any) {
        if (error.code === 'permission-denied') {
          console.log('Conexão com o Firebase verificada com sucesso (permissão negada, o que é esperado sem login).');
        } else {
          console.error('Erro de conexão com as tabelas:', error);
        }
      }
    };
    checkConnection();
  }, []);

  const handleEdit = (order: Order) => {
    setEditingOrder(order);
    setView('form');
  };

  const handleLogin = (newUser: any) => {
    setUser(newUser);
    localStorage.setItem('nsf_user', JSON.stringify(newUser));
    setView('report');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('nsf_user');
    setView('form');
  };

  const navigateToReport = () => {
    setEditingOrder(null);
    if (user) {
      setView('report');
    } else {
      setView('login');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-sky-100 sticky top-0 z-30">
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-sky-300 via-blue-500 to-sky-300"></div>
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('form')}>
            <img src="http://janerik.com.br/wp-content/uploads/2026/03/LOGO-PAROQUIAAtivo-1.png" alt="Paróquia Nossa Senhora de Fátima" className="h-12 object-contain" />
          </div>
          
          <div className="flex items-center gap-4">
            {user && (
              <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
                <User size={14} />
                <span className="font-medium">{user.name}</span>
              </div>
            )}
            
            {user && view !== 'form' && (
              <button 
                onClick={() => setView('form')}
                className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 p-2 rounded-xl transition-colors flex flex-col items-center text-xs font-bold"
              >
                <Plus size={22} className="mb-1" />
                <span>Novo Pedido</span>
              </button>
            )}

            {view !== 'report' && view !== 'users' && view !== 'login' && (
              <button 
                onClick={navigateToReport}
                className="text-blue-900 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-xl transition-colors flex flex-col items-center text-xs font-bold"
              >
                <FileText size={22} className="mb-1" />
                <span>Relatório</span>
              </button>
            )}

            {user && (view === 'report' || view === 'users') && (
              <button 
                onClick={handleLogout}
                className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-xl transition-colors flex flex-col items-center text-xs font-bold"
              >
                <LogOut size={22} className="mb-1" />
                <span>Sair</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section (only on form view) */}
      {view === 'form' && !editingOrder && (
        <div className="relative w-full bg-slate-50 mb-8">
          <div className="max-w-4xl mx-auto">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-white mx-4 mt-6">
              {/* Desktop Layout */}
              <div className="hidden md:flex flex-row items-center">
                <div className="w-1/2 p-12 z-10">
                  <div className="inline-block px-4 py-1.5 rounded-full bg-blue-100 text-blue-800 font-bold text-xs tracking-wider mb-6">
                    COLEÇÃO 2026
                  </div>
                  <h2 className="text-4xl lg:text-5xl font-extrabold text-slate-900 mb-6 leading-[1.1]">
                    Vista sua fé na <span className="text-blue-600">Festa da Padroeira</span>
                  </h2>
                  <p className="text-lg text-slate-600 font-medium mb-8 leading-relaxed">
                    Todos em unidade vestindo a mesma camisa. Adquira já a sua e participe desse momento especial de devoção e comunhão.
                  </p>
                </div>
                <div className="w-1/2 relative">
                  <div className="absolute inset-0 bg-gradient-to-l from-transparent to-white z-10"></div>
                  <img src="http://janerik.com.br/wp-content/uploads/2026/03/mockup-2-CAMISA-2026-FESTA-DA-PADROEIRA.jpg" alt="Camisa Padroeira 2026" className="w-full h-[500px] object-cover object-right" />
                </div>
              </div>

              {/* Mobile Layout */}
              <div className="md:hidden bg-slate-900 flex flex-col">
                <img src="http://janerik.com.br/wp-content/uploads/2026/03/mockup-2-CAMISA-2026-FESTA-DA-PADROEIRA.jpg" alt="Camisa Padroeira 2026" className="w-full h-auto object-contain" />
                <div className="p-6 bg-gradient-to-t from-slate-900 to-slate-800">
                  <div className="inline-block px-3 py-1 rounded-full bg-blue-500 text-white font-bold text-[10px] tracking-wider mb-3">
                    COLEÇÃO 2026
                  </div>
                  <h2 className="text-3xl font-extrabold text-white mb-3 leading-tight drop-shadow-lg">
                    Vista sua fé na Festa da Padroeira
                  </h2>
                  <p className="text-sm text-slate-200 font-medium drop-shadow-md">
                    Todos em unidade vestindo a mesma camisa. Adquira já a sua!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Models Showcase Section */}
          <ModelsShowcase />
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 py-8">
        {view === 'form' && <OrderForm initialOrder={editingOrder} user={user} onSubmit={(order) => { setCurrentOrder(order); setEditingOrder(null); setView('success'); }} />}
        {view === 'success' && currentOrder && <SuccessView order={currentOrder} onNewOrder={() => { setCurrentOrder(null); setEditingOrder(null); setView('form'); }} />}
        {view === 'login' && <LoginView onLogin={handleLogin} onBack={() => setView('form')} />}
        {view === 'report' && <ReportView onBack={() => { setEditingOrder(null); setView('form'); }} onEdit={handleEdit} user={user} onManageUsers={() => setView('users')} />}
        {view === 'users' && user && <UsersView user={user} onBack={() => setView('report')} />}
      </main>
    </div>
  );
}
