import React, { useState } from 'react';
import { Order, OrderStatus } from '../types';
import { ArrowLeft, ChefHat, Bike, CheckCircle, Clock, Printer, X, MapPin, Phone, User, DollarSign, AlertTriangle, GripVertical } from 'lucide-react';

interface KanbanProps {
  orders: Order[];
  onUpdateStatus: (orderId: number, newStatus: OrderStatus, cancelReason?: string) => void;
  onPrintOrder: (order: Order) => void;
  onBack: () => void;
}

const STATUS_COLUMNS: { id: OrderStatus; label: string; icon: any; color: string; border: string }[] = [
  { id: 'CONFIRMED', label: 'Novo / Confirmado', icon: Clock, color: 'bg-gray-100', border: 'border-gray-300' },
  { id: 'KITCHEN', label: 'Na Cozinha', icon: ChefHat, color: 'bg-orange-50', border: 'border-orange-200' },
  { id: 'DELIVERY', label: 'Saiu p/ Entrega', icon: Bike, color: 'bg-blue-50', border: 'border-blue-200' },
  { id: 'COMPLETED', label: 'Finalizado', icon: CheckCircle, color: 'bg-green-50', border: 'border-green-200' },
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

export const Kanban: React.FC<KanbanProps> = ({ orders, onUpdateStatus, onPrintOrder, onBack }) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);
  const [cancelReason, setCancelReason] = useState(CANCEL_REASONS[0]);

  // Filter only "active" orders for the first 3 columns to avoid clutter, 
  // show completed orders only from "today" in the last column.
  const today = new Date().toLocaleDateString('pt-BR');
  
  const getOrdersByStatus = (status: OrderStatus) => {
      return orders.filter(o => {
          if (o.status === 'CANCELED') return false; // Don't show canceled in columns

          // If completed, only show todays
          if (status === 'COMPLETED') {
              return o.status === 'COMPLETED' && o.date.includes(today);
          }
          // Legacy check: if order has no status, assume 'CONFIRMED'
          const s = o.status || 'CONFIRMED';
          return s === status;
      }).sort((a,b) => b.timestamp - a.timestamp); // Newest first
  };

  const handleNextStatus = (e: React.MouseEvent, order: Order) => {
      e.stopPropagation();
      let next: OrderStatus = 'CONFIRMED';
      if (order.status === 'CONFIRMED') next = 'KITCHEN';
      else if (order.status === 'KITCHEN') next = 'DELIVERY';
      else if (order.status === 'DELIVERY') next = 'COMPLETED';
      else return;
      onUpdateStatus(order.id, next);
  };

  const handleCancelConfirm = () => {
      if (selectedOrder) {
          onUpdateStatus(selectedOrder.id, 'CANCELED', cancelReason);
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
      e.preventDefault(); // Necessary to allow dropping
      e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, status: OrderStatus) => {
      e.preventDefault();
      const orderId = Number(e.dataTransfer.getData('orderId'));
      if (orderId && !isNaN(orderId)) {
          onUpdateStatus(orderId, status);
      }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col h-screen font-sans overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 text-wine"><ArrowLeft /></button>
                <h1 className="text-2xl font-serif text-wine font-bold">Acompanhamento de Pedidos (KDS)</h1>
            </div>
        </div>

        {/* Board */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
            <div className="flex gap-4 h-full min-w-[1000px]">
                {STATUS_COLUMNS.map(col => (
                    <div 
                        key={col.id} 
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, col.id)}
                        className={`flex-1 flex flex-col rounded-xl border-t-4 ${col.border} ${col.color} shadow-sm max-w-xs md:max-w-none transition-colors duration-200`}
                    >
                        <div className="p-3 font-bold text-gray-700 flex items-center gap-2 border-b border-black/5">
                            <col.icon size={18} /> {col.label}
                            <span className="ml-auto bg-white/50 px-2 rounded-full text-xs">{getOrdersByStatus(col.id).length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[200px]">
                            {getOrdersByStatus(col.id).map(order => (
                                <div 
                                    key={order.id} 
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, order.id)}
                                    onClick={() => { setSelectedOrder(order); setIsCanceling(false); }}
                                    className="bg-white p-3 rounded-lg shadow cursor-grab active:cursor-grabbing hover:shadow-md hover:scale-[1.02] transition-all border border-transparent hover:border-orange group relative"
                                >
                                    <div className="absolute right-2 top-2 text-gray-300 opacity-50"><GripVertical size={14}/></div>
                                    <div className="flex justify-between items-start mb-2 pr-4">
                                        <span className="font-bold text-wine">#{order.id}</span>
                                        <span className="text-[10px] text-gray-500">{order.date.split(',')[1].trim()}</span>
                                    </div>
                                    <div className="font-bold text-gray-800 mb-1">{order.customer.name}</div>
                                    {order.items.length > 0 && (
                                        <div className="text-xs text-gray-500 mb-2 line-clamp-2">
                                            {order.items.map(i => i.product.sabor).join(', ')}
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center mt-2 border-t pt-2">
                                        <span className="font-bold text-leaf text-sm">{formatCurrency(order.total)}</span>
                                        {col.id !== 'COMPLETED' && (
                                            <button 
                                                onClick={(e) => handleNextStatus(e, order)}
                                                className="bg-gray-100 hover:bg-leaf hover:text-white text-gray-600 px-2 py-1 rounded text-xs font-bold transition-colors"
                                            >
                                                Mover &rarr;
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {getOrdersByStatus(col.id).length === 0 && (
                                <div className="h-full flex items-center justify-center text-gray-400 text-xs italic opacity-50 border-2 border-dashed border-gray-200 rounded m-2">
                                    Arraste aqui
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Detail Modal */}
        {selectedOrder && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="bg-wine p-4 flex justify-between items-center shrink-0 text-white">
                        <div className="flex items-center gap-2">
                             <h3 className="font-bold text-lg">Pedido #{selectedOrder.id}</h3>
                             <span className="bg-white/20 px-2 py-0.5 rounded text-xs uppercase font-bold">{selectedOrder.status || 'CONFIRMED'}</span>
                        </div>
                        <button onClick={() => setSelectedOrder(null)}><X/></button>
                    </div>

                    {!isCanceling ? (
                        <>
                            <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
                                {/* Customer Info */}
                                <div className="bg-white p-4 rounded-lg shadow-sm mb-4 border border-gray-200">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><User size={14}/> Cliente</h4>
                                    <div className="font-bold text-lg">{selectedOrder.customer.name}</div>
                                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                                        <Phone size={14}/> {selectedOrder.customer.phone}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                                        <MapPin size={14}/> {selectedOrder.customer.address}
                                    </div>
                                </div>

                                {/* Order Items */}
                                <div className="bg-white p-4 rounded-lg shadow-sm mb-4 border border-gray-200">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Itens do Pedido</h4>
                                    <div className="space-y-3">
                                        {selectedOrder.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-start border-b border-dashed border-gray-100 pb-2 last:border-0 last:pb-0">
                                                <div>
                                                    <div className="font-bold text-gray-800">
                                                        {item.quantity}x {item.flavors && item.flavors.length > 1 ? `Pizza ${item.flavors.length} Sabores` : item.product.sabor}
                                                    </div>
                                                    {item.flavors && item.flavors.length > 1 && (
                                                        <div className="text-xs text-gray-500 pl-2">
                                                            {item.flavors.map(f => f.sabor).join(' + ')}
                                                        </div>
                                                    )}
                                                    {item.selectedSize && <div className="text-xs text-orange bg-orange/10 inline-block px-1 rounded mt-1">{item.selectedSize} Pedaços</div>}
                                                    {item.observation && (
                                                        <div className="text-xs font-bold text-red-600 mt-1 uppercase">Obs: {item.observation}</div>
                                                    )}
                                                </div>
                                                <div className="font-mono text-gray-600">{formatCurrency(item.price * item.quantity)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Payment Info */}
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-1"><DollarSign size={14}/> Pagamento</h4>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span>Subtotal</span>
                                        <span>{formatCurrency(selectedOrder.subtotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm mb-1 text-orange font-bold">
                                        <span>Taxa Entrega</span>
                                        <span>{formatCurrency(selectedOrder.deliveryFee)}</span>
                                    </div>
                                    <div className="flex justify-between text-xl font-bold text-wine mt-2 border-t pt-2">
                                        <span>Total</span>
                                        <span>{formatCurrency(selectedOrder.total)}</span>
                                    </div>
                                    <div className="mt-2 bg-gray-100 p-2 rounded flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-600">Método: {selectedOrder.paymentMethod}</span>
                                        {selectedOrder.paymentMethod === 'DINHEIRO' && selectedOrder.changeFor && (
                                            <span className="text-xs text-green-600 font-bold">
                                                Troco p/ {formatCurrency(selectedOrder.changeFor)} ({formatCurrency(selectedOrder.changeFor - selectedOrder.total)})
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-white border-t border-gray-200 flex gap-3 flex-col sm:flex-row">
                                <button 
                                    onClick={() => setIsCanceling(true)}
                                    className="px-4 py-3 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg font-bold flex items-center justify-center gap-2"
                                >
                                    <X size={18}/> Cancelar
                                </button>
                                <button 
                                    onClick={() => onPrintOrder(selectedOrder)}
                                    className="flex-1 bg-gray-800 hover:bg-gray-900 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg"
                                >
                                    <Printer size={18}/> Imprimir Comanda
                                </button>
                            </div>
                        </>
                    ) : (
                        // Cancellation View
                        <div className="p-6 bg-gray-50 flex-1 flex flex-col">
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3">
                                <AlertTriangle className="text-red-600 shrink-0" />
                                <div>
                                    <h4 className="font-bold text-red-800">Confirmar Cancelamento</h4>
                                    <p className="text-sm text-red-600">Esta ação não pode ser desfeita. O pedido sairá do fluxo de produção.</p>
                                </div>
                            </div>
                            
                            <label className="text-sm font-bold text-gray-700 mb-2 block">Motivo do Cancelamento:</label>
                            <div className="space-y-2 mb-6">
                                {CANCEL_REASONS.map(reason => (
                                    <label key={reason} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${cancelReason === reason ? 'bg-red-50 border-red-500' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                                        <input 
                                            type="radio" 
                                            name="reason" 
                                            className="accent-red-600 w-4 h-4" 
                                            checked={cancelReason === reason}
                                            onChange={() => setCancelReason(reason)}
                                        />
                                        <span className="text-gray-800">{reason}</span>
                                    </label>
                                ))}
                            </div>

                            <div className="mt-auto flex gap-3">
                                <button 
                                    onClick={() => setIsCanceling(false)}
                                    className="flex-1 bg-white border border-gray-300 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-50"
                                >
                                    Voltar
                                </button>
                                <button 
                                    onClick={handleCancelConfirm}
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold shadow"
                                >
                                    Confirmar Cancelamento
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
};