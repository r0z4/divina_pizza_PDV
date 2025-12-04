import React, { useState, useMemo, useEffect } from 'react';
import { CATEGORIES, PRODUCTS } from './constants';
import { CartItem, Customer, Product, Order, PaymentMethod, OrderStatus, OrderType } from './types';
import { Receipt } from './components/Receipt';
import { CRM } from './components/CRM';
import { Kanban } from './components/Kanban';
import { subscribeToOrders, createOrder, updateOrderStatus } from './services/orderService';
import { 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Printer, 
  Search,
  Check,
  Bike,
  BarChart2,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Utensils,
  ChefHat,
  ShoppingBag,
  Store,
  CloudOff
} from 'lucide-react';

// --- Helper Functions ---
const getPriceForSize = (product: Product, size: number) => {
  return product.tamanhos?.find(t => t.pedaços === size)?.preco || 0;
};

const App: React.FC = () => {
  // --- Global View State ---
  const [view, setView] = useState<'POS' | 'CRM' | 'KANBAN'>('POS');
  
  // --- Data State ---
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES[0]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<Customer>({ name: '', phone: '', address: '' });
  
  // Order Configuration
  const [orderType, setOrderType] = useState<OrderType>('DELIVERY');
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('DINHEIRO');
  const [changeFor, setChangeFor] = useState<string>(''); // Text input for change
  
  // --- UI State: Builder ---
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [builderStep, setBuilderStep] = useState<'SIZE' | 'FLAVORS'>('SIZE');
  const [currentBaseProduct, setCurrentBaseProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [selectedFlavors, setSelectedFlavors] = useState<Product[]>([]);
  const [flavorSearch, setFlavorSearch] = useState('');

  // --- UI State: Search Modal ---
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [searchCategoryFilter, setSearchCategoryFilter] = useState('Todas');
  const [searchPriceMax, setSearchPriceMax] = useState<number>(200);

  // --- Printing State ---
  const [orderToPrint, setOrderToPrint] = useState<Order | null>(null);

  // --- Success Modal State ---
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- Load Data on Mount (Firebase Subscription) ---
  useEffect(() => {
    // This function connects to Firebase and updates 'orders' whenever DB changes
    const unsubscribe = subscribeToOrders((updatedOrders) => {
        setOrders(updatedOrders);
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, []);

  // --- Order Type Effect ---
  // Reset fee when switching to Pickup
  useEffect(() => {
      if (orderType === 'PICKUP') {
          setDeliveryFee(0);
      }
  }, [orderType]);

  // --- Derived State ---
  const filteredProducts = useMemo(() => {
    return PRODUCTS.filter(p => p.categoria === activeCategory);
  }, [activeCategory]);

  const searchResults = useMemo(() => {
      if (!isSearchOpen) return [];
      return PRODUCTS.filter(p => {
          const matchesTerm = p.sabor.toLowerCase().includes(globalSearchTerm.toLowerCase()) || 
                              p.ingredientes?.join(' ').toLowerCase().includes(globalSearchTerm.toLowerCase());
          const matchesCat = searchCategoryFilter === 'Todas' || p.categoria === searchCategoryFilter;
          
          // Price check approximation (lowest size price or base price)
          const price = p.preco || (p.tamanhos ? p.tamanhos[0].preco : 0);
          const matchesPrice = price <= searchPriceMax;

          return matchesTerm && matchesCat && matchesPrice;
      });
  }, [isSearchOpen, globalSearchTerm, searchCategoryFilter, searchPriceMax]);

  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  }, [cart]);

  const cartTotal = cartSubtotal + deliveryFee;

  // Builder Logic
  const allPizzaProducts = useMemo(() => PRODUCTS.filter(p => p.tamanhos && p.tamanhos.length > 0), []);

  const availableFlavorsForModal = useMemo(() => {
    if (!selectedSize) return [];
    return allPizzaProducts.filter(p => {
      const hasSize = p.tamanhos?.some(t => t.pedaços === selectedSize);
      const matchesSearch = p.sabor.toLowerCase().includes(flavorSearch.toLowerCase());
      return hasSize && matchesSearch;
    });
  }, [allPizzaProducts, selectedSize, flavorSearch]);

  const maxFlavors = useMemo(() => {
    if (!selectedSize) return 1;
    return selectedSize === 4 ? 2 : 4;
  }, [selectedSize]);

  // --- Actions ---

  const handleProductClick = (product: Product) => {
    if (product.tamanhos && product.tamanhos.length > 0) {
      setCurrentBaseProduct(product);
      setBuilderStep('SIZE');
      setSelectedSize(null);
      setSelectedFlavors([]);
      setFlavorSearch('');
      setIsBuilderOpen(true);
      setIsSearchOpen(false); // Close search if open
    } else {
      addToCart(product, product.preco || 0);
      setIsSearchOpen(false);
    }
  };

  const handleSizeSelect = (size: number) => {
    setSelectedSize(size);
    if (currentBaseProduct) setSelectedFlavors([currentBaseProduct]);
    setBuilderStep('FLAVORS');
  };

  const handleAddFlavor = (flavor: Product) => {
    if (selectedFlavors.length < maxFlavors) setSelectedFlavors([...selectedFlavors, flavor]);
  };

  const handleRemoveFlavor = (index: number) => {
    const newFlavors = [...selectedFlavors];
    newFlavors.splice(index, 1);
    setSelectedFlavors(newFlavors);
  };

  const calculatePizzaPrice = () => {
    if (!selectedSize || selectedFlavors.length === 0) return 0;
    const totalPrices = selectedFlavors.reduce((acc, flavor) => acc + getPriceForSize(flavor, selectedSize), 0);
    return totalPrices / selectedFlavors.length;
  };

  const finishPizzaBuild = () => {
    if (!currentBaseProduct || !selectedSize) return;
    addToCart(currentBaseProduct, calculatePizzaPrice(), selectedSize, selectedFlavors);
    setIsBuilderOpen(false);
  };

  const addToCart = (product: Product, price: number, size?: number, flavors?: Product[]) => {
    setCart(prev => {
      // Create a unique ID every time to allow separate observations for identical items
      return [...prev, {
          id: `${Date.now()}-${Math.random()}`,
          product,
          price,
          selectedSize: size,
          flavors: flavors,
          quantity: 1,
          observation: ''
        }];
    });
  };

  const updateCartItemObservation = (id: string, obs: string) => {
      setCart(prev => prev.map(item => item.id === id ? { ...item, observation: obs } : item));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateStatus = async (orderId: number, newStatus: OrderStatus, cancelReason?: string) => {
      try {
        await updateOrderStatus(orderId, newStatus, cancelReason);
        // State update happens automatically via the useEffect subscription
      } catch (error) {
        alert("Erro ao atualizar status. Verifique sua conexão.");
        console.error(error);
      }
  };

  const resetOrder = () => {
    setCart([]);
    setCustomer({ name: '', phone: '', address: '' });
    setDeliveryFee(0);
    setPaymentMethod('DINHEIRO');
    setChangeFor('');
    setOrderToPrint(null);
    setShowSuccessModal(false);
  };

  const handleFinishOrder = async () => {
    // 1. Validation Logic
    const errors: string[] = [];

    if (cart.length === 0) {
        errors.push("- O carrinho está vazio.");
    }
    if (!customer.name.trim()) {
        errors.push("- O nome do cliente é obrigatório.");
    }
    if (!customer.phone.trim()) {
        errors.push("- O telefone do cliente é obrigatório.");
    }
    
    // Conditional Validation based on Order Type
    if (orderType === 'DELIVERY') {
        if (!customer.address.trim()) {
            errors.push("- O endereço é obrigatório para entregas.");
        }
    }

    // Payment validation
    const changeVal = parseFloat(changeFor);
    if (paymentMethod === 'DINHEIRO' && changeFor && changeVal < cartTotal) {
        errors.push(`- Valor do troco (R$ ${changeVal}) é menor que o total (R$ ${cartTotal}).`);
    }

    if (errors.length > 0) {
        alert("Não é possível finalizar o pedido:\n" + errors.join("\n"));
        return;
    }

    setIsProcessing(true);

    try {
        // 2. Create Order Object (Without ID, Backend generates it)
        const orderData = {
            date: new Date().toLocaleString('pt-BR'),
            timestamp: Date.now(),
            customer: { ...customer },
            items: [...cart],
            subtotal: cartSubtotal,
            deliveryFee: deliveryFee,
            total: cartTotal,
            paymentMethod: paymentMethod,
            changeFor: paymentMethod === 'DINHEIRO' && changeFor ? parseFloat(changeFor) : undefined,
            status: 'CONFIRMED' as OrderStatus,
            type: orderType
        };

        // 3. Send to Firebase
        const createdOrder = await createOrder(orderData);

        // 4. Print & Show Success
        setOrderToPrint(createdOrder); 
        setTimeout(() => {
            window.print();
            setOrderToPrint(null); 
            setShowSuccessModal(true); 
            setIsProcessing(false);
        }, 200);
        
    } catch (error) {
        console.error(error);
        alert("Erro ao conectar com o servidor. O pedido não foi salvo.");
        setIsProcessing(false);
    }
  };

  const handlePrintFromKanban = (order: Order) => {
      setOrderToPrint(order);
      setTimeout(() => {
          window.print();
          setOrderToPrint(null);
      }, 200);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // --- RENDER ---

  if (view === 'CRM') {
      return <CRM orders={orders} onBack={() => setView('POS')} />;
  }

  if (view === 'KANBAN') {
      return <Kanban orders={orders} onUpdateStatus={handleUpdateStatus} onPrintOrder={handlePrintFromKanban} onBack={() => setView('POS')} />;
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col md:flex-row overflow-hidden font-sans">
      
      {/* --- Main Content Area --- */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden print:hidden">
        
        {/* Header */}
        <header className="bg-wine text-gold p-3 shadow-lg flex items-center justify-between z-10 shrink-0 border-b-4 border-gold">
          <div className="flex items-center gap-3">
             <div className="w-14 h-14 bg-white rounded-full border-2 border-gold flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                 <img 
                    src="/logo.png" 
                    alt="Logo" 
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                 />
                 <span className="text-wine font-bold text-xs absolute opacity-0">PD</span>
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold tracking-wide text-gold">Pizza Divina</h1>
              <p className="text-[10px] text-orange font-bold uppercase tracking-widest">Arte em fazer Pizza</p>
            </div>
          </div>
          <div className="flex gap-2">
             <button 
                onClick={() => setIsSearchOpen(true)}
                className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg flex items-center gap-2 transition-all"
                title="Buscar Produtos"
             >
                 <Search className="w-5 h-5" />
                 <span className="hidden md:inline text-sm font-bold">Buscar</span>
             </button>
             <button 
                onClick={() => setView('KANBAN')}
                className="bg-orange hover:bg-orange-light text-white p-2 rounded-lg flex items-center gap-2 transition-all shadow-md font-bold"
                title="Acompanhamento (Cozinha)"
             >
                 <ChefHat className="w-5 h-5" />
                 <span className="hidden md:inline text-sm">Pedidos</span>
             </button>
             <button 
                onClick={() => setView('CRM')}
                className="bg-gold hover:bg-gold-dark text-wine p-2 rounded-lg flex items-center gap-2 transition-all shadow-md font-bold"
                title="Gestão Financeira"
             >
                 <BarChart2 className="w-5 h-5" />
                 <span className="hidden md:inline text-sm">Gestão</span>
             </button>
          </div>
        </header>

        {/* Categories */}
        <nav className="bg-wine-light text-white overflow-x-auto shrink-0 shadow-md scrollbar-hide">
          <div className="flex px-2 min-w-max">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-5 py-3 font-bold text-xs md:text-sm uppercase tracking-wider transition-colors border-b-4 ${
                  activeCategory === cat 
                    ? 'border-gold text-gold bg-wine/50' 
                    : 'border-transparent text-gray-300 hover:text-white hover:bg-wine/30'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </nav>

        {/* Product Grid */}
        <main className="flex-1 overflow-y-auto p-4 bg-gray-100/50 scroll-smooth">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-serif text-wine border-b-2 border-orange/50 pb-1 inline-block">
                {activeCategory}
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
            {filteredProducts.map((product, idx) => (
              <div 
                key={`${product.sabor}-${idx}`} 
                className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-lg hover:border-orange transition-all duration-200 flex flex-col overflow-hidden group cursor-pointer relative"
                onClick={() => handleProductClick(product)}
              >
                <div className="p-4 flex-1">
                  <h3 className="font-serif text-lg text-wine font-bold leading-tight group-hover:text-orange transition-colors">
                    {product.sabor}
                  </h3>
                  {product.ingredientes && (
                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                      {product.ingredientes.join(', ')}
                    </p>
                  )}
                </div>
                <div className="bg-gray-50 px-4 py-2 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-bold text-leaf">
                    {product.tamanhos ? 'A partir de ' + formatCurrency(product.tamanhos[0].preco) : formatCurrency(product.preco || 0)}
                  </span>
                  <Plus className="w-5 h-5 text-wine group-hover:scale-110 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* --- Sidebar Cart --- */}
      <aside className="w-full md:w-[400px] bg-white shadow-2xl flex flex-col h-[45vh] md:h-screen z-20 print:hidden border-l border-gray-300 relative">
        <div className="bg-wine text-white p-3 flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-gold" />
            <h2 className="font-serif text-lg font-bold">Pedido Atual</h2>
          </div>
          <span className="bg-white/10 px-2 py-0.5 rounded text-xs flex items-center gap-1">
               {isProcessing ? 'Sincronizando...' : `Online: #${orders.length > 0 ? orders[0].id + 1 : 1001}`}
          </span>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
              <ShoppingCart size={48} strokeWidth={1} />
              <p className="mt-2 font-serif text-lg">Sem itens</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 group">
                <div className="flex justify-between items-start">
                    <div className="flex-1">
                        <h4 className="font-bold text-wine text-sm">
                            {item.flavors && item.flavors.length > 1 ? `Pizza ${item.flavors.length} Sabores` : item.product.sabor}
                        </h4>
                        <div className="text-xs text-gray-500 mt-1">
                            {item.selectedSize && <span className="mr-2 bg-yellow-100 text-yellow-800 px-1 rounded">{item.selectedSize} ped.</span>}
                            {item.flavors && item.flavors.length > 1 && (
                                <div className="mt-1 pl-2 border-l-2 border-orange/30">
                                    {item.flavors.map((f, i) => <div key={i}>• {f.sabor}</div>)}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <span className="font-bold text-gray-800">{formatCurrency(item.price)}</span>
                        <button onClick={() => removeFromCart(item.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                {/* Observation Input */}
                <div className="mt-2 pt-2 border-t border-dashed border-gray-100">
                    <input 
                        type="text" 
                        placeholder="Observação (ex: sem cebola)"
                        value={item.observation}
                        onChange={(e) => updateCartItemObservation(item.id, e.target.value)}
                        className="w-full text-xs bg-gray-50 border-b border-gray-200 focus:border-orange outline-none py-1 text-gray-600 placeholder-gray-300 italic"
                    />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Checkout Area */}
        <div className="bg-white border-t border-gray-200 shadow-[0_-4px_10px_-4px_rgba(0,0,0,0.1)] p-4 shrink-0 z-30">
          
          {/* Order Type Toggle */}
          <div className="bg-gray-100 p-1 rounded-lg flex mb-3">
              <button 
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-sm font-bold transition-all ${orderType === 'DELIVERY' ? 'bg-white text-wine shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setOrderType('DELIVERY')}
              >
                  <Bike size={16}/> Entrega
              </button>
              <button 
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-sm font-bold transition-all ${orderType === 'PICKUP' ? 'bg-white text-wine shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setOrderType('PICKUP')}
              >
                  <Store size={16}/> Retirada
              </button>
          </div>

          {/* Customer */}
          <div className="mb-2 space-y-2">
             <div className="flex gap-2">
                 <input 
                   type="text" placeholder="Nome do Cliente *" 
                   value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})}
                   className={`flex-1 bg-gray-50 border rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-orange outline-none ${!customer.name && cart.length > 0 ? 'border-red-200' : 'border-gray-200'}`}
                 />
                 <input 
                   type="text" placeholder="Tel *" 
                   value={customer.phone} onChange={e => setCustomer({...customer, phone: e.target.value})}
                   className={`w-1/3 bg-gray-50 border rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-orange outline-none ${!customer.phone && cart.length > 0 ? 'border-red-200' : 'border-gray-200'}`}
                 />
             </div>
             
             {/* Address Input - Conditional */}
             {orderType === 'DELIVERY' ? (
                <div className="flex gap-2 animate-fade-in">
                    <input 
                        type="text" placeholder="Endereço Completo *" 
                        value={customer.address} onChange={e => setCustomer({...customer, address: e.target.value})}
                        className={`flex-1 bg-gray-50 border rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-orange outline-none ${!customer.address && cart.length > 0 ? 'border-red-200' : 'border-gray-200'}`}
                    />
                </div>
             ) : (
                <div className="flex gap-2 animate-fade-in opacity-50 select-none">
                    <input disabled type="text" value="Retirada no Balcão (Endereço não necessário)" className="flex-1 bg-gray-100 border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-500 italic text-center" />
                </div>
             )}
          </div>

          {/* Payment Method Selector */}
          <div className="mb-3">
             <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Forma de Pagamento</label>
             <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'DINHEIRO', label: 'Dinheiro', icon: Banknote },
                  { id: 'CREDITO', label: 'Crédito', icon: CreditCard },
                  { id: 'DEBITO', label: 'Débito', icon: CreditCard },
                  { id: 'PIX', label: 'Pix', icon: Smartphone },
                  { id: 'REFEICAO', label: 'Refeição', icon: Utensils }
                ].map( method => (
                  <button 
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                    className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded border text-[10px] font-bold transition-all ${paymentMethod === method.id ? 'bg-wine text-gold border-wine' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}
                  >
                    <method.icon size={12} /> {method.label}
                  </button>
                ))}
             </div>
             {/* Change Input (Troco) */}
             {paymentMethod === 'DINHEIRO' && (
                 <div className="mt-2 flex items-center gap-2 animate-fade-in">
                     <label className="text-xs font-bold text-gray-600">Troco p/:</label>
                     <div className="relative flex-1">
                         <span className="absolute left-2 top-1.5 text-gray-400 text-xs">R$</span>
                         <input 
                            type="number" 
                            value={changeFor}
                            onChange={(e) => setChangeFor(e.target.value)}
                            className="w-full pl-6 pr-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange outline-none"
                            placeholder="Valor entregue..."
                         />
                     </div>
                     {changeFor && parseFloat(changeFor) >= cartTotal && (
                         <div className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">
                             Troco: {formatCurrency(parseFloat(changeFor) - cartTotal)}
                         </div>
                     )}
                 </div>
             )}
          </div>

          {/* Delivery Fee Slider */}
          <div className={`mb-3 transition-opacity ${orderType === 'PICKUP' ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
              <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                  <span className="flex items-center gap-1"><Bike size={12}/> Taxa de Entrega</span>
                  <span className="text-orange">{formatCurrency(deliveryFee)}</span>
              </div>
              <input 
                type="range" min="0" max="40" step="1" 
                value={deliveryFee} 
                onChange={(e) => setDeliveryFee(Number(e.target.value))}
                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange"
              />
          </div>

          {/* Totals */}
          <div className="space-y-1 mb-3 text-sm">
             <div className="flex justify-between text-gray-500">
                 <span>Subtotal</span>
                 <span>{formatCurrency(cartSubtotal)}</span>
             </div>
             <div className="flex justify-between text-gray-500">
                 <span>Entrega</span>
                 <span>{orderType === 'PICKUP' ? '--' : formatCurrency(deliveryFee)}</span>
             </div>
             <div className="flex justify-between text-xl font-bold text-wine mt-2 border-t pt-2">
                 <span>Total</span>
                 <span>{formatCurrency(cartTotal)}</span>
             </div>
          </div>

          <button 
            onClick={handleFinishOrder}
            disabled={isProcessing}
            className={`w-full text-white font-bold py-3 rounded-xl shadow-lg flex justify-center items-center gap-2 transition-transform transform active:scale-[0.98] ${isProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-leaf hover:bg-green-700'}`}
          >
            {isProcessing ? (
                <>
                    <CloudOff className="animate-pulse" /> Processando...
                </>
            ) : (
                <>
                     <Printer className="w-5 h-5" /> FINALIZAR PEDIDO
                </>
            )}
            
          </button>
        </div>
      </aside>

      {/* --- Advanced Search Modal --- */}
      {isSearchOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-20 animate-fade-in print:hidden">
              <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                  <div className="p-4 bg-wine text-white flex justify-between items-center shrink-0">
                      <h3 className="font-bold text-lg flex items-center gap-2"><Search size={20}/> Buscar Produto</h3>
                      <button onClick={() => setIsSearchOpen(false)}><X/></button>
                  </div>
                  
                  {/* Filters */}
                  <div className="p-4 bg-gray-50 border-b border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
                      <div className="md:col-span-3">
                          <input 
                            type="text" 
                            autoFocus
                            placeholder="Digite o nome ou ingrediente..." 
                            value={globalSearchTerm}
                            onChange={e => setGlobalSearchTerm(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange outline-none"
                          />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-gray-500 block mb-1">Categoria</label>
                          <select 
                            value={searchCategoryFilter}
                            onChange={e => setSearchCategoryFilter(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded bg-white text-sm"
                          >
                              <option value="Todas">Todas</option>
                              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                      </div>
                      <div className="md:col-span-2">
                           <label className="text-xs font-bold text-gray-500 block mb-1">Preço Máximo: {formatCurrency(searchPriceMax)}</label>
                           <input 
                             type="range" min="10" max="200" step="5"
                             value={searchPriceMax} onChange={e => setSearchPriceMax(Number(e.target.value))}
                             className="w-full accent-orange"
                           />
                      </div>
                  </div>

                  {/* Results */}
                  <div className="flex-1 overflow-y-auto p-4 bg-gray-100">
                      {searchResults.length === 0 ? (
                          <div className="text-center text-gray-400 mt-10">Nenhum produto encontrado.</div>
                      ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {searchResults.map((p, i) => (
                                  <button 
                                    key={i} 
                                    onClick={() => handleProductClick(p)}
                                    className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 hover:border-orange text-left flex justify-between items-center group"
                                  >
                                      <div>
                                          <div className="font-bold text-wine group-hover:text-orange">{p.sabor}</div>
                                          <div className="text-[10px] text-gray-500 uppercase">{p.categoria}</div>
                                      </div>
                                      <div className="font-bold text-leaf text-sm">
                                         {p.tamanhos ? 'Ver tamanhos' : formatCurrency(p.preco || 0)}
                                      </div>
                                  </button>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* --- Pizza Builder Modal --- */}
      {isBuilderOpen && currentBaseProduct && (
        <div className="fixed inset-0 bg-wine/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-wine p-4 flex justify-between items-center shrink-0 border-b border-white/10">
              <div className="text-white">
                 <h3 className="font-serif text-xl font-bold">Montar Pizza</h3>
                 {builderStep === 'FLAVORS' && <p className="text-gold text-xs">Tamanho: {selectedSize} pedaços</p>}
              </div>
              <button onClick={() => setIsBuilderOpen(false)} className="text-white/80 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            
            {builderStep === 'SIZE' && currentBaseProduct.tamanhos && (
                <div className="p-8 flex flex-col gap-6 overflow-y-auto bg-cream">
                    <h4 className="text-center text-xl text-wine font-bold">Escolha o Tamanho</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {currentBaseProduct.tamanhos.map((size) => (
                        <button key={size.pedaços} onClick={() => handleSizeSelect(size.pedaços)}
                            className="flex flex-col items-center justify-center p-6 bg-white border-2 border-gray-200 rounded-2xl hover:border-orange hover:shadow-lg transition-all group">
                            <span className="text-4xl font-bold text-gray-300 group-hover:text-orange mb-2">{size.pedaços}</span>
                            <span className="text-gray-600 font-bold uppercase text-sm">Pedaços</span>
                            <span className="text-xs text-leaf mt-1 font-bold">{formatCurrency(size.preco)}</span>
                        </button>
                        ))}
                    </div>
                </div>
            )}

            {builderStep === 'FLAVORS' && (
                <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
                    <div className="bg-white border-b border-gray-200 p-4 shrink-0 shadow-sm">
                         <div className="flex justify-between items-center mb-3">
                             <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Sabores ({selectedFlavors.length}/{maxFlavors})</h4>
                             <span className="text-xl font-bold text-leaf">{formatCurrency(calculatePizzaPrice())}</span>
                         </div>
                         <div className="flex gap-2 overflow-x-auto pb-2">
                             {Array.from({ length: maxFlavors }).map((_, idx) => {
                                 const flavor = selectedFlavors[idx];
                                 return (
                                    <div key={idx} className={`relative min-w-[100px] h-14 rounded border-2 border-dashed flex items-center justify-center px-2 text-center text-[10px] transition-all ${flavor ? 'bg-orange/10 border-orange solid' : 'border-gray-300 bg-gray-100'}`}>
                                        {flavor ? (
                                            <>
                                              <span className="font-bold text-wine line-clamp-2">{flavor.sabor}</span>
                                              <button onClick={() => handleRemoveFlavor(idx)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow hover:scale-110"><X className="w-3 h-3" /></button>
                                            </>
                                        ) : <span className="text-gray-400">Escolher</span>}
                                    </div>
                                 );
                             })}
                         </div>
                    </div>

                    <div className="p-3 bg-gray-100 border-b border-gray-200">
                         <div className="relative">
                             <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                             <input type="text" placeholder="Buscar sabor..." value={flavorSearch} onChange={(e) => setFlavorSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded text-sm focus:ring-1 focus:ring-orange outline-none" />
                         </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {availableFlavorsForModal.map((p) => (
                                <button key={p.sabor} onClick={() => handleAddFlavor(p)} disabled={selectedFlavors.length >= maxFlavors}
                                    className={`text-left p-3 rounded bg-white border transition-all flex justify-between items-center group ${selectedFlavors.length >= maxFlavors ? 'opacity-50' : 'hover:border-orange hover:shadow-sm border-gray-200'}`}>
                                    <div>
                                        <div className="font-bold text-gray-700 text-sm group-hover:text-orange">{p.sabor}</div>
                                        <div className="text-[10px] text-gray-400 uppercase">{p.categoria}</div>
                                    </div>
                                    <div className="text-gray-400 text-xs font-mono">{formatCurrency(getPriceForSize(p, selectedSize!))}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="p-4 bg-white border-t border-gray-200 flex justify-between gap-3 shrink-0">
                        <button onClick={() => setIsBuilderOpen(false)} className="px-4 py-2 text-gray-500 font-bold hover:text-gray-800">Voltar</button>
                        <button onClick={finishPizzaBuild} disabled={selectedFlavors.length === 0} className="bg-leaf hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold shadow disabled:opacity-50 flex items-center gap-2">
                            <Check className="w-4 h-4" /> Confirmar
                        </button>
                    </div>
                </div>
            )}
          </div>
        </div>
      )}

      {/* --- Success Modal --- */}
      {showSuccessModal && (
          <div className="fixed inset-0 bg-wine/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4 print:hidden animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle className="w-10 h-10 text-leaf" />
                  </div>
                  <h2 className="text-2xl font-bold text-wine mb-2">Pedido Finalizado!</h2>
                  <p className="text-gray-600 mb-8">O pedido foi enviado para a cozinha e para impressão com sucesso.</p>
                  
                  <button 
                      onClick={resetOrder}
                      className="w-full bg-leaf hover:bg-green-700 text-white font-bold py-3 rounded-xl shadow-lg flex justify-center items-center gap-2 transition-transform transform active:scale-[0.98]"
                  >
                      <ShoppingBag size={20} />
                      FAZER NOVO PEDIDO
                  </button>
              </div>
          </div>
      )}

      {/* --- Receipt Logic --- */}
      <Receipt 
        cart={orderToPrint ? orderToPrint.items : cart} 
        customer={orderToPrint ? orderToPrint.customer : customer} 
        subtotal={orderToPrint ? orderToPrint.subtotal : cartSubtotal}
        deliveryFee={orderToPrint ? orderToPrint.deliveryFee : deliveryFee}
        total={orderToPrint ? orderToPrint.total : cartTotal}
        paymentMethod={orderToPrint ? orderToPrint.paymentMethod : paymentMethod}
        changeFor={orderToPrint ? orderToPrint.changeFor : (changeFor ? parseFloat(changeFor) : undefined)}
        orderId={orderToPrint ? orderToPrint.id : (orders.length > 0 ? orders[0].id + 1 : 1001)}
        orderType={orderToPrint ? orderToPrint.type : orderType}
      />

    </div>
  );
};
import { CheckCircle } from 'lucide-react';

export default App;