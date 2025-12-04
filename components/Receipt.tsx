import React from 'react';
import { CartItem, Customer, PaymentMethod, OrderType } from '../types';

interface ReceiptProps {
  cart: CartItem[];
  customer: Customer;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  changeFor?: number;
  orderId?: number;
  orderType?: OrderType;
}

export const Receipt: React.FC<ReceiptProps> = ({ cart, customer, subtotal, deliveryFee, total, paymentMethod, changeFor, orderId, orderType = 'DELIVERY' }) => {
  const date = new Date().toLocaleString('pt-BR');
  const change = changeFor ? changeFor - total : 0;

  return (
    <div id="receipt-area" className="hidden print:block font-mono text-black p-0 m-0 w-[80mm]">
      <div className="text-center mb-4 border-b border-black pb-2">
         {/* Logo Logic */}
         <div className="flex justify-center mb-2">
             <img src="/logo.png" className="h-20 object-contain grayscale" alt="Logo Pizza Divina" onError={(e) => e.currentTarget.style.display = 'none'} />
         </div>
        <h1 className="text-xl font-bold uppercase">Pizza Divina</h1>
        <p className="text-sm">Arte em fazer Pizza</p>
        <p className="text-sm">Rua das Pizzas, 123 - Centro</p>
        <p className="text-sm">Tel: (11) 99999-9999</p>
      </div>

      <div className="mb-4 text-sm border-b border-black pb-2">
        <p className="text-lg font-bold text-center border-b border-dashed mb-2">
            PEDIDO #{orderId || 'NOVO'} <span className="text-xs">({orderType === 'PICKUP' ? 'RETIRADA' : 'ENTREGA'})</span>
        </p>
        <p><strong>Data:</strong> {date}</p>
        <p><strong>Cliente:</strong> {customer.name || 'Não informado'}</p>
        <p><strong>Tel:</strong> {customer.phone || 'Não informado'}</p>
        {orderType === 'DELIVERY' ? (
             <p><strong>End:</strong> {customer.address || 'Não informado'}</p>
        ) : (
             <p><strong>Tipo:</strong> RETIRADA NO BALCÃO</p>
        )}
      </div>

      <div className="mb-4">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-black border-dashed">
              <th className="py-1">Qtd</th>
              <th className="py-1">Item</th>
              <th className="py-1 text-right">R$</th>
            </tr>
          </thead>
          <tbody>
            {cart.map((item) => (
              <tr key={item.id}>
                <td className="py-1 align-top">{item.quantity}x</td>
                <td className="py-1 align-top">
                  {/* Title Logic */}
                  {item.flavors && item.flavors.length > 1 ? (
                    <span className="font-bold">Pizza {item.flavors.length} Sabores</span>
                  ) : (
                    <span className="font-bold">{item.product.sabor}</span>
                  )}
                  
                  {/* Size */}
                  {item.selectedSize && ` (${item.selectedSize} ped.)`}
                  
                  <br />
                  
                  {/* Description / Sub-flavors */}
                  {item.flavors && item.flavors.length > 1 && (
                     <div className="pl-1 mt-1 border-l-2 border-gray-400">
                         {item.flavors.map((f, idx) => (
                             <div key={idx}>- {f.sabor}</div>
                         ))}
                     </div>
                  )}

                  {/* Observations */}
                  {item.observation && (
                    <div className="mt-1 font-bold italic uppercase text-[10px]">
                      ** OBS: {item.observation}
                    </div>
                  )}
                </td>
                <td className="py-1 text-right align-top">
                  {(item.price * item.quantity).toFixed(2).replace('.', ',')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-right border-t border-black border-dashed pt-2 mb-8 space-y-1">
        <p className="text-xs">Subtotal: R$ {subtotal.toFixed(2).replace('.', ',')}</p>
        <p className="text-xs">Taxa Entrega: R$ {deliveryFee.toFixed(2).replace('.', ',')}</p>
        <p className="text-xl font-bold mt-2">TOTAL: R$ {total.toFixed(2).replace('.', ',')}</p>
        <p className="text-sm font-bold mt-1 uppercase">Pagamento: {paymentMethod}</p>
        
        {paymentMethod === 'DINHEIRO' && changeFor && (
            <div className="mt-2 pt-2 border-t border-dashed">
                <p className="text-xs">Troco para: R$ {changeFor.toFixed(2).replace('.', ',')}</p>
                <p className="text-sm font-bold">Troco: R$ {change.toFixed(2).replace('.', ',')}</p>
            </div>
        )}
      </div>

      <div className="text-center text-xs">
        <p>Obrigado pela preferência!</p>
        <p>Volte sempre!</p>
        <p className="mt-2 text-[10px]">Sistema Pizza Divina PDV</p>
      </div>
    </div>
  );
};