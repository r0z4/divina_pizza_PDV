import React from 'react';
import { CartItem, Customer, PaymentMethod, OrderType } from '../types';

interface ReceiptProps {
  cart: CartItem[];
  customer: Customer;
  subtotal: number;
  deliveryFee: number;
  discount?: number;
  total: number;
  paymentMethod: PaymentMethod;
  changeFor?: number;
  orderId?: number;
  orderType?: OrderType;
  deadline?: number;
}

export const Receipt: React.FC<ReceiptProps> = ({ cart, customer, subtotal, deliveryFee, discount = 0, total, paymentMethod, changeFor, orderId, orderType = 'DELIVERY', deadline }) => {
  const date = new Date().toLocaleString('pt-BR');
  const change = changeFor ? changeFor - total : 0;

  const getPaymentLabel = (method: PaymentMethod) => {
    switch(method) {
        case 'PIX': return 'PIX';
        case 'IFOOD': return 'IFOOD ONLINE';
        case 'DINHEIRO': return 'DINHEIRO';
        case 'CREDITO': return 'CREDITO';
        case 'DEBITO': return 'DEBITO';
        case 'REFEICAO': return 'VALE REF.';
        case 'FIADO': return 'FIADO / A PRAZO';
        default: return method;
    }
  };

  const formatMoney = (val: number) => val.toFixed(2).replace('.', ',');

  const formatItemName = (item: CartItem) => {
      if (item.flavors && item.flavors.length > 1) {
          return `Pizza ${item.flavors.length} Sabores`;
      }
      if (item.product.categoria.toLowerCase().includes('pastel')) {
          return `PASTEL - ${item.product.sabor}`;
      }
      return item.product.sabor;
  };

  return (
    <div id="receipt-area" className="bg-white text-black font-mono text-[12px] leading-tight p-4 shadow-lg mx-auto print:shadow-none print:p-0 print:m-0 print:w-full box-border" style={{ width: '100%', maxWidth: '80mm', minHeight: '100px' }}>
      
      {/* Header */}
      <div className="text-center mb-2">
         <h1 className="text-lg font-bold uppercase tracking-wider text-black">DIVINA PIZZA E PASTÉIS</h1>
         <p className="text-[10px] mt-1 text-black">Rua Dr. Luiz Mendes de Almeida, 544</p>
         <p className="text-[10px] text-black">Vila Espírito Santo, Sorocaba - SP</p>
         <p className="text-[10px] font-bold mt-1 text-black">Tel/Whats: (15) 3217-5403</p>
      </div>

      <div className="border-b border-dashed border-black my-1"></div>

      {/* Order Info */}
      <div className="text-center my-2 text-black">
        <p className="text-xl font-extrabold">PEDIDO: #{orderId || 'NOVO'}</p>
        <p className="font-bold text-sm">{orderType === 'PICKUP' ? 'RETIRADA NO BALCÃO' : 'ENTREGA'}</p>
        <p className="text-[10px]">{date}</p>
        {deadline && (
            <p className="text-[10px] mt-1 font-bold">PREVISÃO: {new Date(deadline).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
        )}
      </div>

      <div className="border-b border-dashed border-black my-1"></div>

      {/* Customer */}
      <div className="mb-2 text-black">
        <p className="font-bold uppercase truncate text-sm">{customer.name || 'Cliente Balcão'}</p>
        <p>{customer.phone}</p>
        
        {/* Order Count Logic */}
        <p className="text-[10px] font-bold mt-1 uppercase border border-black inline-block px-1">
            {customer.orderCount && customer.orderCount > 1 
                ? `${customer.orderCount}º Pedido do Cliente` 
                : `*** 1º Pedido do Cliente ***`}
        </p>

        {orderType === 'DELIVERY' && (
             <div className="mt-1 pt-1 border-t border-dashed border-gray-400">
                 {customer.neighborhood && <p className="font-bold text-sm">Bairro: {customer.neighborhood}</p>}
                 <p className="leading-snug text-sm">{customer.address}</p>
                 {customer.complement && <p className="text-[11px] font-bold">Comp: {customer.complement}</p>}
             </div>
        )}
      </div>

      <div className="border-b border-dashed border-black my-1"></div>

      {/* Items */}
      <div className="mb-2 text-black">
        <div className="flex font-bold border-b border-black border-dashed pb-1 mb-1 text-[10px]">
            <span className="w-6">QTD</span>
            <span className="flex-1">ITEM</span>
            <span className="w-12 text-right">VALOR</span>
        </div>
        {cart.map((item) => (
          <div key={item.id} className="mb-2">
            <div className="flex items-start">
                <span className="w-6 font-bold text-sm">{item.quantity}x</span>
                <div className="flex-1">
                    {/* Main Product Name */}
                    <span className="font-bold text-sm">
                        {formatItemName(item)}
                    </span>
                    {item.selectedSize && <span className="text-[10px] ml-1">({item.selectedSize} ped.)</span>}
                    
                    {/* Flavors Detail */}
                    {item.flavors && item.flavors.length > 1 && (
                        <ul className="pl-0 mt-0.5 text-[10px] list-none">
                            {item.flavors.map((f, idx) => {
                                const totalFlavors = item.flavors!.length;
                                const fraction = totalFlavors === 2 ? '1/2' : 
                                                 totalFlavors === 3 ? '1/3' : 
                                                 totalFlavors === 4 ? '1/4' : `1/${totalFlavors}`;
                                return (
                                    <li key={idx} className="leading-tight">
                                        - {fraction} {f.sabor}
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {/* Observation */}
                    {item.observation && (
                        <div className="font-bold uppercase text-[12px] mt-0.5 bg-black text-white inline-block px-1">
                            OBS: {item.observation}
                        </div>
                    )}
                </div>
                <span className="w-12 text-right">{formatMoney(item.price * item.quantity)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-b border-dashed border-black my-1"></div>

      {/* Totals */}
      <div className="flex justify-between text-[11px] text-black">
        <span>Subtotal:</span>
        <span>{formatMoney(subtotal)}</span>
      </div>
      {discount > 0 && (
        <div className="flex justify-between text-[11px] text-black">
            <span>Desconto:</span>
            <span>- {formatMoney(discount)}</span>
        </div>
      )}
      <div className="flex justify-between text-[11px] text-black">
        <span>Taxa Entrega:</span>
        <span>{formatMoney(deliveryFee)}</span>
      </div>
      
      <div className="flex justify-between text-xl font-bold mt-1 border-t border-black border-dashed pt-1 text-black">
        <span>TOTAL:</span>
        <span>{formatMoney(total)}</span>
      </div>

      <div className="mt-2 text-center border border-black p-1 font-bold text-black">
        <p className="text-[10px] uppercase mb-0.5">Forma de Pagamento</p>
        <p className="text-sm">{getPaymentLabel(paymentMethod)}</p>
        
        {paymentMethod === 'FIADO' && (
            <p className="text-sm border-t border-black border-dashed mt-1 pt-1 block font-extrabold uppercase">
                *** NÃO COBRAR AGORA ***
            </p>
        )}

        {paymentMethod === 'DINHEIRO' && changeFor && (
            <p className="text-sm border-t border-black border-dashed mt-1 pt-1 block">
                Troco p/ {formatMoney(changeFor)}: R$ {formatMoney(change)}
            </p>
        )}
      </div>

      {/* Footer Space for Cut */}
      <div className="mt-6 text-center text-[10px] text-black">
        <p>www.divinapizzaepasteis.com.br</p>
        <p className="mt-1">Obrigado pela preferência!</p>
        
        {/* Copyright */}
        <p className="mt-4 pt-1 border-t border-dotted border-gray-400 text-[8px] opacity-70">
            Dev. by Tech&Store | Robson Rosa CEO
        </p>
        <p className="text-[8px] opacity-70 mb-8">
            (15) 98819-5768
        </p>
      </div>
    </div>
  );
};