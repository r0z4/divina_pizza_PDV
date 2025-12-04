import React, { useMemo, useState } from 'react';
import { Order, Customer, PaymentMethod } from '../types';
import { Download, Users, Calendar, DollarSign, ArrowLeft, Search, TrendingUp, CreditCard, Wallet, AlertCircle, FileSpreadsheet } from 'lucide-react';

interface CRMProps {
  orders: Order[];
  onBack: () => void;
}

type Tab = 'DASHBOARD' | 'ORDERS' | 'CLOSURE';

export const CRM: React.FC<CRMProps> = ({ orders, onBack }) => {
  const [activeTab, setActiveTab] = useState<Tab>('DASHBOARD');
  const [orderSearch, setOrderSearch] = useState('');

  // --- Helpers ---
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  
  const isSameDay = (d1: Date, d2: Date) => d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
  const getStartOfWeek = (d: Date) => { const date = new Date(d); date.setDate(d.getDate() - d.getDay()); date.setHours(0,0,0,0); return date; };
  const getStartOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

  // --- CSV Export Logic ---
  const handleExportCSV = () => {
    // 1. Define Headers
    const headers = [
        "ID",
        "Data",
        "Hora",
        "Tipo",
        "Cliente",
        "Telefone",
        "Endereço",
        "Pagamento",
        "Total Produtos",
        "Taxa Entrega",
        "Total Geral",
        "Status",
        "Itens (Resumo)"
    ];

    // 2. Map Data
    const rows = orders.map(o => {
        const dateObj = new Date(o.timestamp);
        const dateStr = dateObj.toLocaleDateString('pt-BR');
        const timeStr = dateObj.toLocaleTimeString('pt-BR');
        const itemsSummary = o.items.map(i => `${i.quantity}x ${i.product.sabor}`).join(' | ');

        return [
            o.id,
            dateStr,
            timeStr,
            o.type === 'PICKUP' ? 'Retirada' : 'Entrega',
            `"${o.customer.name.replace(/"/g, '""')}"`, // Escape quotes
            `"${o.customer.phone}"`,
            `"${o.customer.address.replace(/"/g, '""')}"`,
            o.paymentMethod,
            (o.total - o.deliveryFee).toFixed(2).replace('.', ','),
            o.deliveryFee.toFixed(2).replace('.', ','),
            o.total.toFixed(2).replace('.', ','),
            o.status,
            `"${itemsSummary.replace(/"/g, '""')}"`
        ].join(';'); // Use semicolon for Excel compatibility in some regions, or comma
    });

    // 3. Construct CSV Content
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" // Add BOM for Excel UTF-8
        + headers.join(";") + "\n" 
        + rows.join("\n");

    // 4. Trigger Download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pizza_divina_vendas_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- 1. Dashboard Logic (Comparatives) ---
  const comparatives = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    
    const startOfThisWeek = getStartOfWeek(today);
    const startOfLastWeek = new Date(startOfThisWeek); startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

    let todayTotal = 0, yesterdayTotal = 0;
    let weekTotal = 0, lastWeekTotal = 0;
    let monthTotal = 0; // Keeping month simple for now

    orders.forEach(o => {
        const d = new Date(o.timestamp);
        // Day
        if (isSameDay(d, today)) todayTotal += o.total;
        if (isSameDay(d, yesterday)) yesterdayTotal += o.total;
        
        // Week
        if (d >= startOfThisWeek) weekTotal += o.total;
        else if (d >= startOfLastWeek && d < startOfThisWeek) lastWeekTotal += o.total;

        // Month
        if (d >= getStartOfMonth(today)) monthTotal += o.total;
    });

    return {
        today: { val: todayTotal, prev: yesterdayTotal, label: 'Hoje vs Ontem' },
        week: { val: weekTotal, prev: lastWeekTotal, label: 'Esta Semana vs Anterior' },
        month: { val: monthTotal }
    };
  }, [orders]);

  // --- 2. Closure Logic (Fechamento) ---
  const closureData = useMemo(() => {
    // Filter for TODAY only
    const today = new Date();
    const todaysOrders = orders.filter(o => isSameDay(new Date(o.timestamp), today) && o.status !== 'CANCELED');

    const totalSales = todaysOrders.reduce((acc, o) => acc + o.total, 0);
    const totalFees = todaysOrders.reduce((acc, o) => acc + o.deliveryFee, 0);
    const totalWithoutFees = totalSales - totalFees;

    // Breakdown by Method
    const byMethod: Record<PaymentMethod, number> = {
        'DINHEIRO': 0, 'CREDITO': 0, 'DEBITO': 0, 'REFEICAO': 0, 'PIX': 0
    };

    todaysOrders.forEach(o => {
        if (byMethod[o.paymentMethod] !== undefined) {
            byMethod[o.paymentMethod] += o.total;
        }
    });

    return { totalSales, totalFees, totalWithoutFees, byMethod, count: todaysOrders.length };
  }, [orders]);

  // --- 3. Filtered Orders ---
  const filteredOrders = useMemo(() => {
    if (!orderSearch) return [...orders].reverse(); // Show newest first
    const lower = orderSearch.toLowerCase();
    return orders.filter(o => 
        o.id.toString().includes(lower) || 
        o.customer.name.toLowerCase().includes(lower) || 
        o.customer.phone.includes(lower)
    ).reverse();
  }, [orders, orderSearch]);

  // --- Chart Bar Component (Simple CSS) ---
  const ComparisonBar = ({ current, previous, label }: { current: number, previous: number, label: string }) => {
      const max = Math.max(current, previous, 1);
      const currPct = (current / max) * 100;
      const prevPct = (previous / max) * 100;
      const diff = current - previous;
      const isPositive = diff >= 0;

      return (
          <div className="mb-6 bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
              <div className="flex justify-between mb-2">
                  <span className="font-bold text-gray-700 text-sm">{label}</span>
                  <span className={`text-xs font-bold ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                      {isPositive ? '+' : ''}{formatCurrency(diff)}
                  </span>
              </div>
              
              {/* Current Bar */}
              <div className="flex items-center gap-2 mb-2">
                  <div className="w-16 text-xs text-right text-gray-500">Atual</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div className="bg-leaf h-full rounded-full transition-all duration-500" style={{ width: `${currPct}%` }}></div>
                  </div>
                  <div className="w-20 text-xs font-bold text-leaf text-right">{formatCurrency(current)}</div>
              </div>

              {/* Previous Bar */}
              <div className="flex items-center gap-2">
                  <div className="w-16 text-xs text-right text-gray-500">Anterior</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div className="bg-gray-400 h-full rounded-full transition-all duration-500" style={{ width: `${prevPct}%` }}></div>
                  </div>
                  <div className="w-20 text-xs font-bold text-gray-500 text-right">{formatCurrency(previous)}</div>
              </div>
          </div>
      );
  }

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col h-screen font-sans">
        {/* Header Fixed */}
        <div className="bg-white border-b border-gray-200 p-4 flex flex-col md:flex-row justify-between items-center shrink-0">
            <div className="flex items-center gap-4 w-full md:w-auto">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 text-wine"><ArrowLeft /></button>
                <h1 className="text-2xl font-serif text-wine font-bold">Gestão & CRM</h1>
            </div>
            
            <div className="flex gap-2 mt-4 md:mt-0 w-full md:w-auto overflow-x-auto items-center">
                <button 
                    onClick={() => setActiveTab('DASHBOARD')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${activeTab === 'DASHBOARD' ? 'bg-wine text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                    <TrendingUp size={16} /> Visão Geral
                </button>
                <button 
                    onClick={() => setActiveTab('CLOSURE')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${activeTab === 'CLOSURE' ? 'bg-wine text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                    <DollarSign size={16} /> Fechamento Caixa
                </button>
                <button 
                    onClick={() => setActiveTab('ORDERS')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${activeTab === 'ORDERS' ? 'bg-wine text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                    <Search size={16} /> Consultar Pedidos
                </button>

                <div className="w-px h-8 bg-gray-300 mx-2 hidden md:block"></div>

                <button 
                    onClick={handleExportCSV}
                    className="px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 shadow-sm"
                    title="Baixar histórico em CSV"
                >
                    <FileSpreadsheet size={16} /> Exportar CSV
                </button>
            </div>
        </div>

        {/* Content Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                
                {/* --- TAB: DASHBOARD --- */}
                {activeTab === 'DASHBOARD' && (
                    <div className="animate-fade-in">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             {/* Stats Grid */}
                             <div className="grid grid-cols-2 gap-4 h-min">
                                <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-leaf">
                                    <p className="text-gray-500 text-xs font-bold uppercase">Hoje</p>
                                    <h3 className="text-xl font-bold text-gray-800">{formatCurrency(comparatives.today.val)}</h3>
                                </div>
                                <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-gold">
                                    <p className="text-gray-500 text-xs font-bold uppercase">Semana</p>
                                    <h3 className="text-xl font-bold text-gray-800">{formatCurrency(comparatives.week.val)}</h3>
                                </div>
                                <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-orange">
                                    <p className="text-gray-500 text-xs font-bold uppercase">Mês</p>
                                    <h3 className="text-xl font-bold text-gray-800">{formatCurrency(comparatives.month.val)}</h3>
                                </div>
                                <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-wine">
                                    <p className="text-gray-500 text-xs font-bold uppercase">Total Pedidos</p>
                                    <h3 className="text-xl font-bold text-gray-800">{orders.length}</h3>
                                </div>
                             </div>

                             {/* Comparisons Charts */}
                             <div>
                                 <h3 className="text-lg font-bold text-wine mb-4 flex items-center gap-2"><TrendingUp size={20}/> Comparativos de Vendas</h3>
                                 <ComparisonBar current={comparatives.today.val} previous={comparatives.today.prev} label="Hoje vs Ontem" />
                                 <ComparisonBar current={comparatives.week.val} previous={comparatives.week.prev} label="Esta Semana vs Anterior" />
                             </div>
                         </div>
                    </div>
                )}

                {/* --- TAB: CLOSURE (FECHAMENTO) --- */}
                {activeTab === 'CLOSURE' && (
                    <div className="animate-fade-in max-w-4xl mx-auto">
                        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                            <div className="bg-gray-800 text-white p-6 text-center">
                                <h2 className="text-2xl font-bold mb-1">Fechamento de Caixa</h2>
                                <p className="opacity-80 text-sm flex justify-center items-center gap-2">
                                    <Calendar size={14} /> {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                            </div>
                            
                            <div className="p-8">
                                {/* Big Totals */}
                                <div className="flex flex-col md:flex-row gap-8 mb-8 pb-8 border-b border-gray-100">
                                    <div className="flex-1 text-center">
                                        <p className="text-gray-500 text-sm font-bold uppercase mb-1">Total Bruto (Com Taxas)</p>
                                        <p className="text-4xl font-bold text-leaf">{formatCurrency(closureData.totalSales)}</p>
                                        <p className="text-gray-400 text-xs mt-2">{closureData.count} pedidos hoje</p>
                                    </div>
                                    <div className="w-px bg-gray-200 hidden md:block"></div>
                                    <div className="flex-1 grid grid-cols-2 gap-4">
                                        <div className="text-center">
                                            <p className="text-gray-500 text-xs font-bold uppercase mb-1">Produtos (Liq)</p>
                                            <p className="text-xl font-bold text-gray-800">{formatCurrency(closureData.totalWithoutFees)}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-gray-500 text-xs font-bold uppercase mb-1">Taxas Entrega</p>
                                            <p className="text-xl font-bold text-orange">{formatCurrency(closureData.totalFees)}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Breakdown */}
                                <h3 className="text-lg font-bold text-wine mb-4 flex items-center gap-2"><Wallet size={20}/> Detalhamento por Pagamento</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {Object.entries(closureData.byMethod).map(([method, amount]) => (
                                        <div key={method} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded text-white ${
                                                    method === 'DINHEIRO' ? 'bg-green-600' :
                                                    method === 'PIX' ? 'bg-teal-500' :
                                                    method === 'REFEICAO' ? 'bg-orange' : 'bg-blue-600'
                                                }`}>
                                                    {method === 'DINHEIRO' ? <DollarSign size={16}/> : <CreditCard size={16}/>}
                                                </div>
                                                <span className="font-bold text-gray-700 capitalize">{method}</span>
                                            </div>
                                            <span className="font-mono font-bold text-lg">{formatCurrency(amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TAB: ORDERS (CONSULTA) --- */}
                {activeTab === 'ORDERS' && (
                    <div className="animate-fade-in">
                        <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-3">
                            <Search className="text-gray-400" />
                            <input 
                                type="text" 
                                placeholder="Buscar por Nº Pedido, Nome Cliente ou Telefone..." 
                                value={orderSearch}
                                onChange={e => setOrderSearch(e.target.value)}
                                className="flex-1 outline-none text-lg bg-transparent"
                            />
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-xs">
                                    <tr>
                                        <th className="px-6 py-3">#</th>
                                        <th className="px-6 py-3">Tipo</th>
                                        <th className="px-6 py-3">Data</th>
                                        <th className="px-6 py-3">Cliente</th>
                                        <th className="px-6 py-3">Pagamento</th>
                                        <th className="px-6 py-3 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredOrders.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-gray-400">Nenhum pedido encontrado.</td>
                                        </tr>
                                    ) : (
                                        filteredOrders.map(order => (
                                            <tr key={order.id} className={`hover:bg-gray-50 ${order.status === 'CANCELED' ? 'opacity-50 bg-red-50' : ''}`}>
                                                <td className="px-6 py-4 font-mono font-bold text-wine">#{order.id}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${order.type === 'PICKUP' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                                        {order.type === 'PICKUP' ? 'Retirada' : 'Entrega'}
                                                    </span>
                                                    {order.status === 'CANCELED' && <div className="text-red-600 text-[10px] font-bold mt-1">CANCELADO</div>}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{order.date}</td>
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-gray-800">{order.customer.name}</div>
                                                    <div className="text-xs text-gray-500">{order.customer.phone}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 bg-gray-100 rounded text-xs font-bold text-gray-600">{order.paymentMethod}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold text-leaf">{formatCurrency(order.total)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};