import React, { useState, useEffect, useMemo } from 'react';
import { Order, OrderStatus, Employee, ActiveShift, PaymentMethod, SystemUser } from '../types';
import { ArrowLeft, ChefHat, Bike, CheckCircle, Clock, Printer, X, MapPin, Phone, User, GripVertical, CreditCard, Banknote, Smartphone, Globe, Utensils, History, PlusCircle, Ban, Store, DollarSign, Timer, Archive, RotateCcw, Box, NotebookPen } from 'lucide-react';

interface KanbanProps {
  orders: Order[];
  employees: Employee[];
  activeShift: ActiveShift[];
  onUpdateStatus: (orderId: number, newStatus: OrderStatus, cancelReason?: string, driverName?: string, canceledBy?: string) => void;
  onPrintOrder: (order: Order) => void;
  onBack: () => void;
  onRegisterDriver: () => void;
  currentUser: SystemUser;
}

const STATUS_COLUMNS: { id: OrderStatus; label: string; icon: any; color: string; darkColor: string; border: string; darkBorder: string }[] = [
  { id: 'CONFIRMED', label: 'Novo / Confirmado', icon: Clock, color: 'bg-gray-100', darkColor: 'dark:bg-gray-800/50', border: 'border-gray-300', darkBorder: 'dark:border-gray-600' },
  { id: 'KITCHEN', label: 'Na Cozinha', icon: ChefHat, color: 'bg-orange-50', darkColor: 'dark:bg-orange-900/10', border: 'border-orange-200', darkBorder: 'dark:border-orange-900' },
  { id: 'DELIVERY', label: 'Saiu p/ Entrega / Pronto', icon: Bike, color: 'bg-blue-50', darkColor: 'dark:bg-blue-900/10', border: 'border-blue-200', darkBorder: 'dark:border-blue-900' },
  { id: 'COMPLETED', label: 'Finalizado', icon: CheckCircle, color: 'bg-green-50', darkColor: 'dark:bg-green-900/10', border: 'border-green-200', darkBorder: 'dark:border-green-900' },
  { id: 'CANCELED', label: 'Cancelados', icon: Ban, color: 'bg-red-50', darkColor: 'dark:bg-red-900/10', border: 'border-red-200', darkBorder: 'dark:border-red-900' },
];

const CANCEL_REASONS = [
    "Teste",
    "Pedido Duplicado",
    "Cancelado pelo Cliente",
    "Cancelado pela Loja",
    "Golpe / Trote",
    "Loja Fechada",
    "Endereço fora da área",
    "Outros"
];

const OrderTimer = ({ deadline }: { deadline?: number }) => {
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        if (!deadline) return;
        
        const updateTimer = () => {
            const now = Date.now();
            const diff = Math.max(0, deadline - now);
            setTimeLeft(diff);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 60000); // Update every minute
        return () => clearInterval(interval);
    }, [deadline]);

    if (!deadline) return null;

    const minutesLeft = Math.ceil(timeLeft / 60000);
    
    let colorClass = 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border-green-200';
    if (minutesLeft < 15) {
        colorClass = 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border-red-200 animate-pulse';
    } else if (minutesLeft < 30) {
        colorClass = 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300 border-orange-200';
    }

    return (
        <div className={`text-xs font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${colorClass}`}>
            <Timer size={10} />
            {minutesLeft} min
        </div>
    );
};

export const Kanban: React.FC<KanbanProps> = ({ orders, employees, activeShift, onUpdateStatus, onPrintOrder, onBack, onRegisterDriver, currentUser }) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);
  const [cancelReason, setCancelReason] = useState(CANCEL_REASONS[0]);
  
  // State for Driver Selection Modal
  const [driverSelectOrder, setDriverSelectOrder] = useState<Order | null>(null);

  // State for Archive Modal
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);

  // State for Custom Confirm Modal
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);

  const activeDrivers = employees.filter(e => e.isDriver && activeShift.some(s => s.employeeId === e.id));

  // Filter only "active" orders for active columns, but keep cancelled history for today
  const today = new Date().toLocaleDateString('pt-BR');
  
  const getOrdersByStatus = (status: OrderStatus) => {
      return orders.filter(o => {
          // If status is ARCHIVED, do not show in any column
          if (o.status === 'ARCHIVED') return false;

          // Logic for COMPLETED and CANCELED: Only show today's in the columns
          if (status === 'COMPLETED' || status === 'CANCELED') {
              return (o.status === status) && o.date.includes(today);
          }
          
          // For active statuses, show all (even from previous days if not closed)
          // But exclude canceled ones from active columns
          if (o.status === 'CANCELED') return false;
          
          const s = o.status || 'CONFIRMED';
          return s === status;
      }).sort((a,b) => b.timestamp - a.timestamp); 
  };

  // --- Archive Logic ---
  const archivedOrdersByDate = useMemo(() => {
      // Get orders that are ARCHIVED (Primary) 
      // OR orders that are COMPLETED/CANCELED but NOT from today (Older history automatically becomes archive-viewable)
      const list = orders.filter(o => {
          if (o.status === 'ARCHIVED') return true;
          // If it's completed/canceled but not today, it acts as archived in the modal
          if ((o.status === 'COMPLETED' || o.status === 'CANCELED') && !o.date.includes(today)) return true;
          return false;
      });

      // Group by Date
      const grouped: Record<string, Order[]> = {};
      list.forEach(order => {
          // Assuming order.date format is "DD/MM/YYYY, HH:mm:ss"
          const dateKey = order.date.split(',')[0].trim();
          if (!grouped[dateKey]) grouped[dateKey] = [];
          grouped[dateKey].push(order);
      });

      // Sort dates descending
      return Object.entries(grouped).sort((a, b) => {
          // Simple string comparison for YYYY-MM-DD would be easier, but let's parse DD/MM/YYYY
          const partsA = a[0].split('/').map(n => Number(n));
          const partsB = b[0].split('/').map(n => Number(n));
          const dateA = new Date(partsA[2], partsA[1]-1, partsA[0]);
          const dateB = new Date(partsB[2], partsB[1]-1, partsB[0]);
          return dateB.getTime() - dateA.getTime();
      });
  }, [orders, today]);

  const handleArchiveOrder = (e: React.MouseEvent, orderId: number) => {
      e.stopPropagation();
      onUpdateStatus(orderId, 'ARCHIVED');
  };

  const handleRestoreOrder = (orderId: number) => {
      setConfirmModal({
          isOpen: true,
          title: "Restaurar Pedido",
          message: "Deseja restaurar este pedido para a coluna 'Finalizados'?",
          onConfirm: () => {
              onUpdateStatus(orderId, 'COMPLETED');
              // Note: We do NOT close the archive modal here to keep workflow smooth
              // setIsArchiveOpen(false); 
              setConfirmModal(null);
          }
      });
  };

  const handleNextStatus = (e: React.MouseEvent, order: Order) => {
      e.stopPropagation();
      let next: OrderStatus = 'CONFIRMED';
      
      if (order.status === 'CONFIRMED') next = 'KITCHEN';
      else if (order.status === 'KITCHEN') {
          // Check if moving to delivery requires driver selection
          if (order.type === 'DELIVERY') {
             setDriverSelectOrder(order);
             return; // Stop here, wait for modal selection
          } else {
             next = 'DELIVERY'; // Pickup orders go to delivery column too (Wait for Pickup)
          }
      }
      else if (order.status === 'DELIVERY') next = 'COMPLETED';
      else return;

      onUpdateStatus(order.id, next);
  };

  const confirmDriver = (driverName: string) => {
      if (driverSelectOrder) {
          onUpdateStatus(driverSelectOrder.id, 'DELIVERY', undefined, driverName);
          setDriverSelectOrder(null);
      }
  };

  const handleCancelConfirm = () => {
      if (selectedOrder) {
          onUpdateStatus(selectedOrder.id, 'CANCELED', cancelReason, undefined, currentUser.name);
          setSelectedOrder(null);
          setIsCanceling(false);
      }
  };

  // --- Drag and Drop Logic ---
  const handleDragStart = (e: React.DragEvent, orderId: number) => {
      e.dataTransfer.setData('orderId', orderId.toString());
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault(); 
      e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, status: OrderStatus) => {
      e.preventDefault();
      
      // Prevent dropping INTO canceled column or Archived (not a column)
      if (status === 'CANCELED' || status === 'ARCHIVED') return;

      const orderId = Number(e.dataTransfer.getData('orderId'));
      if (orderId && !isNaN(orderId)) {
          const order = orders.find(o => o.id === orderId);
          
          // Prevent moving canceled orders back to other columns via drag
          if (order?.status === 'CANCELED') return;

          // Fix: Trigger driver modal if dropping into DELIVERY column and order is Delivery type
          if (order && status === 'DELIVERY' && order.type === 'DELIVERY') {
               setDriverSelectOrder(order);
          } else {
               onUpdateStatus(orderId, status);
          }
      }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const getPaymentLabel = (method: PaymentMethod) => {
      switch(method) {
          case 'PIX': return 'Pix';
          case 'IFOOD': return 'iFood';
          case 'DINHEIRO': return 'Dinheiro';
          case 'CREDITO': return 'Crédito';
          case 'DEBITO': return 'Débito';
          case 'REFEICAO': return 'VR/VA';
          case 'FIADO': return 'Fiado';
          default: return method;
      }
  };

  const isOnlinePayment = (method: PaymentMethod) => {
      return method === 'PIX' || method === 'IFOOD' || method === 'FIADO'; // Fiado is treated as "no collection needed" by driver
  };

  const getPaymentStyle = (method: PaymentMethod) => {
      if (method === 'FIADO') return 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800';
      if (isOnlinePayment(method)) return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
      return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
  };

  const formatItemName = (product: any, flavors?: any[]) => {
      if (flavors && flavors.length > 1) {
          return `Pizza ${flavors.length} Sabores`;
      }
      if (product.categoria.toLowerCase().includes('pastel')) {
          return `Pastel - ${product.sabor}`;
      }
      return product.sabor;
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900 h-full flex flex-col font-sans overflow-hidden transition-colors duration-200">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-wine dark:text-gray-200"><ArrowLeft /></button>
                <h1 className="text-xl md:text-2xl font-serif text-wine dark:text-gold font-bold truncate">KDS Cozinha</h1>
            </div>
            
            <button 
                onClick={() => setIsArchiveOpen(true)}
                className="flex items-center gap-2 px-3 md:px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600"
            >
                <Archive size={18} /> <span className="hidden md:inline">Histórico</span>
            </button>
        </div>

        {/* Board */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
            <div className="flex gap-4 h-full min-w-[1250px]">
                {STATUS_COLUMNS.map(col => (
                    <div 
                        key={col.id} 
                        onDragOver={col.id === 'CANCELED' ? undefined : handleDragOver}
                        onDrop={col.id === 'CANCELED' ? undefined : (e) => handleDrop(e, col.id)}
                        className={`flex-1 flex flex-col rounded-xl border-t-4 ${col.border} ${col.darkBorder} ${col.color} ${col.darkColor} shadow-sm max-w-xs md:max-w-none transition-colors duration-200`}
                    >
                        <div className="p-3 font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2 border-b border-black/5 dark:border-white/5">
                            <col.icon size={18} /> {col.label}
                            <span className="ml-auto bg-white/50 dark:bg-black/20 px-2 rounded-full text-xs">{getOrdersByStatus(col.id).length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[200px]">
                            {getOrdersByStatus(col.id).map(order => (
                                <div 
                                    key={order.id} 
                                    draggable={col.id !== 'CANCELED'} 
                                    onDragStart={(e) => handleDragStart(e, order.id)}
                                    onClick={() => { setSelectedOrder(order); setIsCanceling(false); }}
                                    className={`bg-white dark:bg-gray-700 p-3 rounded-lg shadow transition-all border border-transparent group relative
                                        ${col.id !== 'CANCELED' 
                                            ? 'cursor-grab active:cursor-grabbing hover:shadow-md hover:scale-[1.02] hover:border-orange dark:hover:border-orange' 
                                            : 'opacity-75 hover:opacity-100 cursor-pointer border-red-100 dark:border-red-900/50'}`}
                                >
                                    {col.id !== 'CANCELED' && (
                                        <div className="absolute right-2 top-2 text-gray-300 dark:text-gray-500 opacity-50"><GripVertical size={14}/></div>
                                    )}
                                    <div className="flex justify-between items-start mb-2 pr-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-wine dark:text-gray-100">#{order.id}</span>
                                            <span className="text-[10px] text-gray-500 dark:text-gray-400">{order.date.split(',')[1].trim()}</span>
                                        </div>
                                        {/* Timer Badge */}
                                        {col.id !== 'COMPLETED' && col.id !== 'CANCELED' && (
                                            <OrderTimer deadline={order.deadline} />
                                        )}
                                    </div>
                                    <div className="font-bold text-gray-800 dark:text-gray-200 leading-tight">{order.customer.name}</div>
                                    
                                    <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-bold border ${order.type === 'PICKUP' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' : 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800'}`}>
                                            {order.type === 'PICKUP' ? <Store size={10}/> : <Bike size={10}/>}
                                            {order.type === 'PICKUP' ? 'Retira' : 'Entrega'}
                                        </span>

                                        <div className={`flex flex-col justify-center text-[10px] px-1.5 py-0.5 rounded font-bold border ${getPaymentStyle(order.paymentMethod)}`}>
                                             <div className="flex items-center gap-1">
                                                {order.paymentMethod === 'FIADO' ? <NotebookPen size={10}/> : isOnlinePayment(order.paymentMethod) ? <CheckCircle size={10}/> : <DollarSign size={10}/>}
                                                {getPaymentLabel(order.paymentMethod)}
                                                <span className="opacity-70 ml-0.5 uppercase text-[9px]">
                                                    {order.paymentMethod === 'FIADO' ? '(A Prazo)' : isOnlinePayment(order.paymentMethod) ? '(Pago)' : '(Cobrar)'}
                                                </span>
                                             </div>
                                             
                                             {order.paymentMethod === 'DINHEIRO' && order.changeFor && (
                                                 <span className="block border-t border-yellow-200 dark:border-yellow-800 mt-0.5 pt-0.5 text-[9px] font-extrabold text-red-600 dark:text-red-300">
                                                     Troco: {formatCurrency(order.changeFor - order.total)}
                                                 </span>
                                             )}
                                        </div>
                                    </div>

                                    {order.items.length > 0 && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
                                            {order.items.map(i => formatItemName(i.product, i.flavors)).join(', ')}
                                        </div>
                                    )}
                                    
                                    {order.type === 'PICKUP' && col.id === 'DELIVERY' && (
                                        <div className="mb-2 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 rounded px-2 py-1 text-xs font-bold border border-blue-200 dark:border-blue-800 text-center animate-pulse">
                                            PRONTO PARA RETIRADA
                                        </div>
                                    )}

                                    {col.id === 'CANCELED' && order.cancelReason && (
                                        <div className="mb-2 bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 rounded px-2 py-1 text-xs font-bold border border-red-200 dark:border-red-800">
                                            {order.cancelReason}
                                        </div>
                                    )}
                                    
                                    {order.driverName && col.id !== 'CANCELED' && (
                                        <div className="mb-2 bg-orange/10 text-orange rounded px-2 py-0.5 text-xs font-bold inline-flex items-center gap-1">
                                            <Bike size={10} /> {order.driverName}
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center mt-2 border-t border-gray-100 dark:border-gray-600 pt-2">
                                        <span className="font-bold text-leaf dark:text-green-400 text-sm">{formatCurrency(order.total)}</span>
                                        
                                        <div className="flex items-center gap-2">
                                            {/* Manual Archive Button for Completed Orders */}
                                            {col.id === 'COMPLETED' && (
                                                <button 
                                                    onClick={(e) => handleArchiveOrder(e, order.id)}
                                                    className="bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-600 dark:text-gray-300 p-1 rounded transition-colors"
                                                    title="Arquivar Pedido"
                                                >
                                                    <Box size={14} />
                                                </button>
                                            )}

                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onPrintOrder(order);
                                                }}
                                                className="bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 text-gray-600 dark:text-gray-300 p-1 rounded transition-colors"
                                                title="Imprimir Cupom"
                                            >
                                                <Printer size={14} />
                                            </button>

                                            {col.id !== 'COMPLETED' && col.id !== 'CANCELED' && (
                                                <button 
                                                    onClick={(e) => handleNextStatus(e, order)}
                                                    className="bg-gray-100 dark:bg-gray-600 hover:bg-leaf dark:hover:bg-leaf hover:text-white text-gray-600 dark:text-gray-200 px-2 py-1 rounded text-xs font-bold transition-colors"
                                                >
                                                    Mover &rarr;
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* --- Archive Modal --- */}
        {isArchiveOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white dark:bg-gray-800 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-gray-200 dark:border-gray-700">
                    <div className="p-4 bg-gray-100 dark:bg-gray-700/50 flex justify-between items-center shrink-0 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="font-bold text-lg text-gray-700 dark:text-gray-200 flex items-center gap-2">
                            <Archive className="text-wine dark:text-gold" /> Pedidos Arquivados / Finalizados
                        </h3>
                        <button onClick={() => setIsArchiveOpen(false)}><X /></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4">
                        {archivedOrdersByDate.length === 0 ? (
                            <div className="text-center p-8 text-gray-400">Nenhum pedido arquivado encontrado.</div>
                        ) : (
                            <div className="space-y-6">
                                {archivedOrdersByDate.map(([date, groupOrders]) => (
                                    <div key={date}>
                                        <h4 className="bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-200 mb-2 inline-block border border-gray-200 dark:border-gray-600">
                                            {date}
                                        </h4>
                                        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-sm min-w-[500px]">
                                                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 uppercase text-xs">
                                                        <tr>
                                                            <th className="p-3">#</th>
                                                            <th className="p-3">Hora</th>
                                                            <th className="p-3">Cliente</th>
                                                            <th className="p-3">Status</th>
                                                            <th className="p-3">Total</th>
                                                            <th className="p-3 text-right">Ação</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                        {groupOrders.map(order => (
                                                            <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                                <td className="p-3 font-bold text-wine dark:text-gold">#{order.id}</td>
                                                                <td className="p-3 dark:text-gray-300">
                                                                    {order.date.split(',')[1]}
                                                                    {order.canceledAt && <span className="block text-[10px] text-red-500">Cancelado</span>}
                                                                </td>
                                                                <td className="p-3 font-bold dark:text-gray-200">{order.customer.name}</td>
                                                                <td className="p-3">
                                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${order.status === 'CANCELED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                                                                        {order.status}
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 font-mono font-bold dark:text-gray-200">{formatCurrency(order.total)}</td>
                                                                <td className="p-3 text-right">
                                                                    <button 
                                                                        onClick={() => handleRestoreOrder(order.id)}
                                                                        className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-3 py-1.5 rounded flex items-center gap-2 ml-auto text-xs font-bold border border-blue-200 dark:border-blue-800"
                                                                    >
                                                                        <RotateCcw size={14} /> Restaurar
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* Driver Selection Modal */}
        {driverSelectOrder && (
             <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                 <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                     <div className="bg-wine p-4 text-white flex justify-between items-center">
                         <h3 className="font-bold">Selecionar Entregador</h3>
                         <button onClick={() => setDriverSelectOrder(null)}><X/></button>
                     </div>
                     <div className="p-4 space-y-2">
                         <p className="text-sm text-gray-500 mb-4">Quem levará o pedido #{driverSelectOrder.id}?</p>
                         {activeDrivers.length === 0 ? (
                             <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-3 rounded-lg text-sm text-center font-bold mb-3 border border-red-100 dark:border-red-800">
                                 <p>Nenhum entregador na escala de hoje!</p>
                             </div>
                         ) : (
                             activeDrivers.map(d => (
                                 <button 
                                    key={d.id} 
                                    onClick={() => confirmDriver(d.name)}
                                    className="w-full text-left p-3 rounded bg-gray-50 dark:bg-gray-700 hover:bg-orange/10 hover:border-orange border border-transparent dark:text-white font-bold transition-all"
                                 >
                                     {d.name}
                                 </button>
                             ))
                         )}
                         
                         {/* Register New Driver Action */}
                         <button 
                             onClick={onRegisterDriver}
                             className="w-full p-3 rounded border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center gap-2"
                         >
                             <PlusCircle size={16} /> Cadastrar Entregador
                         </button>

                         {/* Option to proceed without driver (e.g., store pickup logic override or external driver) */}
                         <button onClick={() => confirmDriver('')} className="w-full p-3 text-center text-xs text-gray-500 underline mt-2">Seguir sem atribuir</button>
                     </div>
                 </div>
             </div>
        )}

        {/* Detail Modal */}
        {selectedOrder && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-gray-200 dark:border-gray-700">
                    <div className={`p-4 flex justify-between items-center shrink-0 text-white ${selectedOrder.status === 'CANCELED' ? 'bg-red-600' : 'bg-wine'}`}>
                        <div className="flex items-center gap-2">
                             <h3 className="font-bold text-lg">Detalhes do Pedido #{selectedOrder.id}</h3>
                             <span className="bg-white/20 px-2 py-0.5 rounded text-xs uppercase font-bold">{selectedOrder.status === 'CANCELED' ? 'CANCELADO' : selectedOrder.status}</span>
                        </div>
                        <button onClick={() => setSelectedOrder(null)}><X/></button>
                    </div>

                    {!isCanceling ? (
                        <>
                            <div className="p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900 flex-1 space-y-6">
                                
                                {/* Timer Inside Modal */}
                                {selectedOrder.deadline && selectedOrder.status !== 'COMPLETED' && selectedOrder.status !== 'CANCELED' && (
                                    <div className="flex justify-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-xs text-gray-500 uppercase font-bold">Tempo Restante</span>
                                            <div className="scale-125">
                                                <OrderTimer deadline={selectedOrder.deadline} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Cancel Information Block */}
                                {selectedOrder.status === 'CANCELED' && (
                                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
                                        <h4 className="text-red-700 dark:text-red-300 font-bold uppercase text-xs mb-2 flex items-center gap-2"><Ban size={14}/> Dados do Cancelamento</h4>
                                        <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                                            <p><strong>Motivo:</strong> {selectedOrder.cancelReason}</p>
                                            <p><strong>Cancelado por:</strong> {selectedOrder.canceledBy || 'Sistema'}</p>
                                            <p><strong>Horário:</strong> {selectedOrder.canceledAt ? new Date(selectedOrder.canceledAt).toLocaleTimeString('pt-BR') : '-'}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Customer Info */}
                                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                                    <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3 flex items-center gap-1 border-b dark:border-gray-700 pb-2"><User size={14}/> Dados do Cliente</h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 dark:text-gray-400 text-sm">Nome:</span>
                                            <div className="flex flex-col items-end">
                                                <span className="font-bold text-gray-800 dark:text-gray-200">{selectedOrder.customer.name}</span>
                                                <span className="text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-1 rounded flex items-center gap-1">
                                                    <History size={10} /> Pedido nº {selectedOrder.customer.orderCount || 1}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500 dark:text-gray-400 text-sm">Telefone:</span>
                                            <span className="font-bold text-gray-800 dark:text-gray-200">{selectedOrder.customer.phone}</span>
                                        </div>
                                        {selectedOrder.type === 'DELIVERY' && (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500 dark:text-gray-400 text-sm">Bairro:</span>
                                                    <span className="font-bold text-gray-800 dark:text-gray-200">{selectedOrder.customer.neighborhood}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500 dark:text-gray-400 text-sm">Endereço:</span>
                                                    <span className="font-bold text-gray-800 dark:text-gray-200 text-right max-w-[60%]">{selectedOrder.customer.address}</span>
                                                </div>
                                                {selectedOrder.customer.complement && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500 dark:text-gray-400 text-sm">Comp:</span>
                                                        <span className="font-bold text-gray-800 dark:text-gray-200">{selectedOrder.customer.complement}</span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        <div className="mt-3 pt-2 border-t border-dashed dark:border-gray-700 flex flex-col gap-1">
                                            {selectedOrder.driverName && (
                                                <div className="text-sm font-bold text-orange flex items-center gap-2">
                                                    <Bike size={16}/> Entregador: {selectedOrder.driverName}
                                                </div>
                                            )}
                                            {selectedOrder.operatorName && (
                                                <div className="text-xs text-gray-500 flex items-center gap-2">
                                                    <User size={12}/> Captado por: <strong>{selectedOrder.operatorName}</strong>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Order Items */}
                                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                                    <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3 border-b dark:border-gray-700 pb-2">Itens do Pedido</h4>
                                    <div className="space-y-3">
                                        {selectedOrder.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-start border-b border-dashed border-gray-100 dark:border-gray-700 pb-2 last:border-0 last:pb-0">
                                                <div>
                                                    <div className="font-bold text-gray-800 dark:text-gray-200 text-sm">
                                                        {item.quantity}x {formatItemName(item.product, item.flavors)}
                                                        {item.selectedSize && <span className="ml-2 text-[10px] uppercase bg-orange/10 text-orange border border-orange/20 px-1 rounded">({item.selectedSize} Pedaços)</span>}
                                                    </div>
                                                    {item.observation && (
                                                        <div className="text-xs text-red-500 italic mt-0.5">Obs: {item.observation}</div>
                                                    )}
                                                    {item.flavors && item.flavors.length > 1 && (
                                                        <div className="text-xs text-gray-500 ml-2">
                                                            {item.flavors.map((f, i) => {
                                                                const total = item.flavors!.length;
                                                                const fraction = total === 2 ? '1/2' : total === 3 ? '1/3' : total === 4 ? '1/4' : `1/${total}`;
                                                                return <div key={i}>{fraction} {f.sabor}</div>
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="font-mono text-gray-600 dark:text-gray-400 text-sm">{formatCurrency(item.price * item.quantity)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Financial Info */}
                                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                                    <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3 border-b dark:border-gray-700 pb-2 flex items-center gap-1"><Banknote size={14}/> Financeiro</h4>
                                    
                                    <div className="space-y-1 text-sm">
                                        <div className="flex justify-between text-gray-600 dark:text-gray-400">
                                            <span>Subtotal</span>
                                            <span>{formatCurrency(selectedOrder.subtotal)}</span>
                                        </div>
                                        {selectedOrder.discount && selectedOrder.discount > 0 && (
                                            <div className="flex justify-between text-green-600 font-bold">
                                                <span>Desconto</span>
                                                <span>- {formatCurrency(selectedOrder.discount)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-gray-600 dark:text-gray-400">
                                            <span>Taxa de Entrega</span>
                                            <span>{formatCurrency(selectedOrder.deliveryFee)}</span>
                                        </div>
                                        <div className="flex justify-between text-lg font-bold text-wine dark:text-gold pt-2 mt-2 border-t dark:border-gray-700">
                                            <span>Total</span>
                                            <span>{formatCurrency(selectedOrder.total)}</span>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-dashed dark:border-gray-700">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold text-gray-500 uppercase">Forma de Pagamento:</span>
                                        </div>
                                        <div className={`p-3 rounded-lg border font-bold text-center flex items-center justify-center gap-2 ${getPaymentStyle(selectedOrder.paymentMethod)}`}>
                                            {selectedOrder.paymentMethod === 'PIX' && <Smartphone size={18} />}
                                            {selectedOrder.paymentMethod === 'IFOOD' && <Globe size={18} />}
                                            {selectedOrder.paymentMethod === 'DINHEIRO' && <Banknote size={18} />}
                                            {(selectedOrder.paymentMethod === 'CREDITO' || selectedOrder.paymentMethod === 'DEBITO') && <CreditCard size={18} />}
                                            {selectedOrder.paymentMethod === 'FIADO' && <NotebookPen size={18} />}
                                            {getPaymentLabel(selectedOrder.paymentMethod)}
                                        </div>
                                        {selectedOrder.paymentMethod === 'DINHEIRO' && selectedOrder.changeFor && (
                                            <div className="text-center text-xs text-gray-500 mt-2">
                                                Troco para: <strong>{formatCurrency(selectedOrder.changeFor)}</strong> (Troco: {formatCurrency(selectedOrder.changeFor - selectedOrder.total)})
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex gap-3 flex-col sm:flex-row">
                                {selectedOrder.status !== 'CANCELED' && (
                                    <button onClick={() => setIsCanceling(true)} className="px-4 py-3 border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-bold flex items-center justify-center gap-2"><X size={18}/> Cancelar Pedido</button>
                                )}
                                <button onClick={() => onPrintOrder(selectedOrder)} className="flex-1 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg"><Printer size={18}/> Imprimir</button>
                            </div>
                        </>
                    ) : (
                         <div className="p-6 bg-gray-50 dark:bg-gray-900 flex-1 flex flex-col">
                            {/* Cancellation Reason logic */}
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2 block">Motivo do Cancelamento:</label>
                            <div className="space-y-2 mb-6">
                                {CANCEL_REASONS.map(reason => (
                                    <label key={reason} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${cancelReason === reason ? 'bg-red-50 border-red-500' : 'bg-white border-gray-200'}`}>
                                        <input type="radio" name="reason" className="accent-red-600" checked={cancelReason === reason} onChange={() => setCancelReason(reason)}/>
                                        <span className="text-gray-800">{reason}</span>
                                    </label>
                                ))}
                            </div>
                            <div className="mt-auto flex gap-3">
                                <button onClick={() => setIsCanceling(false)} className="flex-1 bg-white border border-gray-300 text-gray-700 py-3 rounded-lg font-bold">Voltar</button>
                                <button onClick={handleCancelConfirm} className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold">Confirmar Cancelamento</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Custom Confirm Modal */}
        {confirmModal && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full border border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">{confirmModal.title}</h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm">{confirmModal.message}</p>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setConfirmModal(null)}
                            className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={confirmModal.onConfirm}
                            className="flex-1 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors"
                        >
                            Confirmar
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};