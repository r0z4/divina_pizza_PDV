import React from 'react';
import { CartItem, Customer, OrderType } from '../types';

interface KitchenReceiptProps {
  cart: CartItem[];
  customer: Customer;
  orderId?: number;
  orderType?: OrderType;
  date: string;
  deadline?: number;
}

export const KitchenReceipt: React.FC<KitchenReceiptProps> = ({ cart, customer, orderId, orderType = 'DELIVERY', date, deadline }) => {
  
  return (
    <div id="kitchen-receipt-area" className="bg-white text-black font-sans leading-tight p-3 mx-auto print:p-0 print:m-0 print:w-full box-border" style={{ width: '100%', maxWidth: '80mm', minHeight: '100px' }}>
      
      {/* Header Compacto */}
      <div className="text-center border-b-2 border-black pb-2 mb-2">
         <div className="flex justify-between items-center mb-1">
             <h1 className="text-3xl font-extrabold leading-none">#{orderId}</h1>
             <span className={`text-sm font-bold uppercase px-2 py-0.5 border border-black rounded ${orderType === 'PICKUP' ? 'bg-black text-white' : ''}`}>
                 {orderType === 'PICKUP' ? 'RETIRADA' : 'ENTREGA'}
             </span>
         </div>
         
         <div className="flex justify-between text-xs font-bold mt-1">
            <span>{date.split(',')[1] || date}</span>
            {deadline && (
                <span>PREV: {new Date(deadline).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
            )}
         </div>
         
         <p className="text-sm font-bold mt-1 truncate uppercase text-left border-t border-dashed border-gray-400 pt-1">
            Cliente: {customer.name}
         </p>
      </div>

      {/* Items */}
      <div className="mb-4">
        {cart.map((item) => {
            // Verifica se é uma Pizza (tem tamanho selecionado)
            const isPizza = !!item.selectedSize;
            // Verifica se é Pastel
            const isPastel = item.product.categoria.toLowerCase().includes('pastel');

            // Garante lista de sabores (usa flavors se existir, senão usa o product principal como array)
            const flavorsList = item.flavors && item.flavors.length > 0 ? item.flavors : [item.product];

            return (
              <div key={item.id} className="mb-3 pb-2 border-b-2 border-black last:border-0 last:pb-0">
                <div className="flex items-start gap-2">
                    {/* Quantidade */}
                    <span className="text-3xl font-black w-8 text-center leading-none mt-1">{item.quantity}</span>
                    
                    <div className="flex-1">
                        {/* Título Principal do Item */}
                        <span className="text-xl font-extrabold block leading-tight uppercase mb-1">
                            {isPizza 
                                ? `PIZZA ${item.selectedSize} PEDAÇOS` 
                                : isPastel
                                    ? item.product.categoria.toUpperCase() // PASTEL SALGADO / DOCE
                                    : item.product.sabor // Título padrão para outros itens
                            }
                        </span>

                        {/* Conteúdo para PIZZAS (Lista de Sabores) */}
                        {isPizza && (
                            <div className="pl-1 space-y-2">
                                {flavorsList.map((f, idx) => {
                                    const totalFlavors = flavorsList.length;
                                    // Se tiver mais de 1 sabor, mostra a fração (1/2, 1/3). Se for inteira, não mostra nada antes.
                                    const fraction = totalFlavors > 1 
                                        ? (totalFlavors === 2 ? '1/2' : totalFlavors === 3 ? '1/3' : `1/${totalFlavors}`)
                                        : ''; 

                                    return (
                                        <div key={idx} className={`${totalFlavors > 1 ? 'border-l-4 border-black pl-2' : ''}`}>
                                            <span className="text-lg font-bold block leading-tight">
                                                {fraction} {f.sabor}
                                            </span>
                                            {f.ingredientes && (
                                                <span className="text-sm font-medium text-gray-700 italic block leading-tight mt-0.5">
                                                    {f.ingredientes.join(', ')}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Conteúdo para PASTEIS (Lista de Sabores/Recheio) */}
                        {isPastel && (
                            <div className="pl-1 space-y-2">
                                <div className="border-l-4 border-black pl-2">
                                    <span className="text-lg font-bold block leading-tight">
                                        {item.product.sabor}
                                    </span>
                                    {item.product.ingredientes && (
                                        <span className="text-sm font-medium text-gray-700 italic block leading-tight mt-0.5">
                                            {item.product.ingredientes.join(', ')}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Conteúdo para OUTROS (Ingredientes do item único) */}
                        {!isPizza && !isPastel && (
                            <>
                                {/* Categoria auxiliar (ex: Bebida) */}
                                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">
                                    {item.product.categoria}
                                </span>
                                
                                {item.product.ingredientes && (
                                    <p className="text-sm text-gray-600 italic leading-snug mt-0.5">
                                        ({item.product.ingredientes.join(', ')})
                                    </p>
                                )}
                            </>
                        )}

                        {/* Observação Geral do Item */}
                        {item.observation && (
                            <div className="mt-2 bg-black text-white text-lg font-bold px-2 py-1 inline-block rounded border-2 border-black print:border-black print:text-black print:bg-transparent">
                                OBS: {item.observation}
                            </div>
                        )}
                    </div>
                </div>
              </div>
            );
        })}
      </div>

      {/* Footer */}
      <div className="mt-4 text-center text-[10px] font-bold border-t border-black pt-1">
        <p>VIA DA COZINHA</p>
        <p className="mt-2 font-normal text-[8px] opacity-70">Tech&Store | Robson Rosa (15) 98819-5768</p>
        <p className="mb-4">.</p>
      </div>
    </div>
  );
};