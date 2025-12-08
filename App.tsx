import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CATEGORIES, PRODUCTS } from './constants';
import { CartItem, Customer, Product, Order, PaymentMethod, OrderStatus, OrderType, Employee, ActiveShift, SystemUser } from './types';
import { Receipt } from './components/Receipt';
import { KitchenReceipt } from './components/KitchenReceipt';
import { CRM, CRMTab } from './components/CRM';
import { Kanban } from './components/Kanban';
import { Inventory } from './components/Inventory';
import { Login } from './components/Login';
import { UserManagement } from './components/UserManagement';
import { subscribeToOrders, createOrder, updateOrderStatus, setForceOffline, getLocalOrders, findCustomerHistory } from './services/orderService';
import { subscribeToBlockedItems, setInventoryForceOffline } from './services/inventoryService';
import { subscribeToEmployees, setStaffForceOffline } from './services/staffService';
import { saveOrUpdateCustomer } from './services/customerService';
import { getSession, logout, initializeAuth } from './services/authService';
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
  CloudOff,
  Sun,
  Moon,
  CheckCircle,
  Pizza,
  AlertTriangle,
  PackageOpen,
  Ban,
  Wifi,
  WifiOff,
  Download,
  Percent,
  DollarSign,
  Globe,
  User,
  MapPin,
  History,
  Minus,
  LogOut,
  Settings,
  Clock,
  Save,
  Watch,
  AlertCircle,
  FileText,
  Menu,
  ShieldCheck, 
  ShieldAlert,
  NotebookPen, // New Icon for Fiado
  Lock,
  Unlock
} from 'lucide-react';

// --- Helper Functions ---
const getPriceForSize = (product: Product, size: number) => {
  return product.tamanhos?.find(t => t.pedaços === size)?.preco || 0;
};

// Helper to check if two items are identical for grouping
const isSameItem = (item1: CartItem, product: Product, price: number, size?: number, flavors?: Product[], observation: string = '') => {
    // 1. Check basic product ID/Name
    if (item1.product.sabor !== product.sabor) return false;
    
    // 2. Check Size
    if (item1.selectedSize !== size) return false;

    // 3. Check Price (just in case)
    if (item1.price !== price) return false;

    // 4. Check Flavors (Must handle arrays, sort them to ensure order doesn't matter)
    const flavors1 = item1.flavors ? item1.flavors.map(f => f.sabor).sort().join(',') : '';
    const flavors2 = flavors ? flavors.map(f => f.sabor).sort().join(',') : '';
    if (flavors1 !== flavors2) return false;

    // 5. Check Observation (Empty observation is equal to undefined or empty)
    const obs1 = item1.observation || '';
    const obs2 = observation || '';
    if (obs1.trim().toLowerCase() !== obs2.trim().toLowerCase()) return false;

    return true;
};

// Helper to format display name in UI (Updated for Cart consistency)
const formatCartItemTitle = (item: CartItem) => {
    if (item.selectedSize) {
        return `Pizza ${item.selectedSize} Pedaços`;
    }
    // Para Pastéis, retorna a Categoria (ex: Pastel Salgado) para o título principal
    if (item.product.categoria.toLowerCase().includes('pastel')) {
        return item.product.categoria;
    }
    return item.product.sabor;
};

// --- Clock Component ---
const ClockWidget = () => {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
      const timer = setInterval(() => setTime(new Date()), 1000);
      return () => clearInterval(timer);
    }, []);
    return (
      <div className="hidden lg:flex flex-col items-end justify-center text-white leading-tight mr-4 px-3 border-r border-white/20">
         <div className="text-xl font-bold font-mono tracking-widest text-gold drop-shadow-md">
             {time.toLocaleTimeString('pt-BR')}
         </div>
         <div className="text-[10px] opacity-75 uppercase tracking-wide">
             {time.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
         </div>
      </div>
    );
};

const App: React.FC = () => {
  // --- Auth State ---
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(null);

  // --- Theme State ---
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
        const savedTheme = localStorage.getItem('theme');
        return savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // --- Init Auth & Session ---
  useEffect(() => {
      initializeAuth();
      const session = getSession();
      if (session) {
          setCurrentUser(session);
      }
  }, []);

  // --- CONFIGURATIONS & STATE PERSISTENCE ---
  const [deliveryTimeConfig, setDeliveryTimeConfig] = useState<number>(() => {
      const saved = localStorage.getItem('deliveryTimeConfig');
      return saved ? parseInt(saved) : 60; 
  });

  const [pickupTimeConfig, setPickupTimeConfig] = useState<number>(() => {
      const saved = localStorage.getItem('pickupTimeConfig');
      return saved ? parseInt(saved) : 30; 
  });

  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number>(() => {
      const saved = localStorage.getItem('sessionTimeoutMinutes');
      return saved ? parseInt(saved) : 60; // Default 60 mins
  });

  const [isStoreOpen, setIsStoreOpen] = useState<boolean>(() => {
      const saved = localStorage.getItem('isStoreOpen');
      return saved !== 'false'; // Default True
  });

  const [dismissedStoreClosed, setDismissedStoreClosed] = useState(false);

  // --- PERSISTENT CART & ORDER STATE ---
  const [cart, setCart] = useState<CartItem[]>(() => {
      const saved = localStorage.getItem('persistent_cart');
      return saved ? JSON.parse(saved) : [];
  });

  const [customer, setCustomer] = useState<Customer>(() => {
      const saved = localStorage.getItem('persistent_customer');
      return saved ? JSON.parse(saved) : { name: '', phone: '', address: '', neighborhood: '', complement: '', orderCount: 0 };
  });

  const [customerStatus, setCustomerStatus] = useState<'IDLE' | 'FOUND' | 'NEW'>(() => {
      const saved = localStorage.getItem('persistent_customerStatus');
      return (saved as any) || 'IDLE';
  });

  const [orderType, setOrderType] = useState<OrderType>(() => {
      const saved = localStorage.getItem('persistent_orderType');
      return (saved as OrderType) || 'DELIVERY';
  });

  const [deliveryFee, setDeliveryFee] = useState<number>(() => {
      const saved = localStorage.getItem('persistent_deliveryFee');
      return saved ? parseFloat(saved) : 0;
  });

  const [discountValue, setDiscountValue] = useState<string>(() => {
      return localStorage.getItem('persistent_discountValue') || '';
  });

  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENT'>(() => {
      const saved = localStorage.getItem('persistent_discountType');
      return (saved as any) || 'FIXED';
  });

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() => {
      const saved = localStorage.getItem('persistent_paymentMethod');
      return (saved as PaymentMethod) || 'DINHEIRO';
  });

  const [changeFor, setChangeFor] = useState<string>(() => {
      return localStorage.getItem('persistent_changeFor') || '';
  });

  // --- Effects to Save State Changes ---
  useEffect(() => localStorage.setItem('persistent_cart', JSON.stringify(cart)), [cart]);
  useEffect(() => localStorage.setItem('persistent_customer', JSON.stringify(customer)), [customer]);
  useEffect(() => localStorage.setItem('persistent_customerStatus', customerStatus), [customerStatus]);
  useEffect(() => localStorage.setItem('persistent_orderType', orderType), [orderType]);
  useEffect(() => localStorage.setItem('persistent_deliveryFee', deliveryFee.toString()), [deliveryFee]);
  useEffect(() => localStorage.setItem('persistent_discountValue', discountValue), [discountValue]);
  useEffect(() => localStorage.setItem('persistent_discountType', discountType), [discountType]);
  useEffect(() => localStorage.setItem('persistent_paymentMethod', paymentMethod), [paymentMethod]);
  useEffect(() => localStorage.setItem('persistent_changeFor', changeFor), [changeFor]);
  useEffect(() => localStorage.setItem('isStoreOpen', isStoreOpen.toString()), [isStoreOpen]);
  useEffect(() => localStorage.setItem('sessionTimeoutMinutes', sessionTimeoutMinutes.toString()), [sessionTimeoutMinutes]);

  // Reset dismissed state when store re-opens
  useEffect(() => {
      if (isStoreOpen) {
          setDismissedStoreClosed(false);
      }
  }, [isStoreOpen]);

  // Listen for ESC key to dismiss "Store Closed" popup
  useEffect(() => {
      const handleEsc = (e: KeyboardEvent) => {
          if (e.key === 'Escape' && !isStoreOpen && !dismissedStoreClosed) {
              setDismissedStoreClosed(true);
          }
      };
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
  }, [isStoreOpen, dismissedStoreClosed]);

  // --- Session Timeout Logic ---
  useEffect(() => {
      if (!currentUser) return;

      const updateActivity = () => {
          localStorage.setItem('pizza_divina_last_activity', Date.now().toString());
      };

      // Listen for interactions
      window.addEventListener('click', updateActivity);
      window.addEventListener('keypress', updateActivity);
      window.addEventListener('mousemove', updateActivity);

      // Check interval
      const interval = setInterval(() => {
          const lastActivity = parseInt(localStorage.getItem('pizza_divina_last_activity') || '0');
          const now = Date.now();
          // Timeout in ms
          const timeoutMs = sessionTimeoutMinutes * 60 * 1000;
          
          if (now - lastActivity > timeoutMs) {
              handleLogout();
              alert("Sua sessão expirou por inatividade.");
          }
      }, 30000); // Check every 30s

      return () => {
          window.removeEventListener('click', updateActivity);
          window.removeEventListener('keypress', updateActivity);
          window.removeEventListener('mousemove', updateActivity);
          clearInterval(interval);
      };
  }, [currentUser, sessionTimeoutMinutes]);


  // --- Online/Offline Mode State ---
  const [isOnlineMode, setIsOnlineMode] = useState(true);

  // --- Global View State ---
  const [view, setView] = useState<'POS' | 'CRM' | 'KANBAN' | 'INVENTORY' | 'USERS'>('POS');
  const [crmInitialTab, setCrmInitialTab] = useState<CRMTab | undefined>(undefined);
  
  // --- Data State ---
  const [orders, setOrders] = useState<Order[]>([]);
  const [blockedItems, setBlockedItems] = useState<string[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  // Active Shift State (Local Persistence)
  const [activeShift, setActiveShift] = useState<ActiveShift[]>(() => {
      const saved = localStorage.getItem('activeShift');
      return saved ? JSON.parse(saved) : [];
  });

  // --- Shift Enforcement Logic ---
  const [enforceShiftLogic, setEnforceShiftLogic] = useState(() => {
      const saved = localStorage.getItem('enforceShiftLogic');
      return saved !== 'false'; // Default to true (Restricted)
  });

  useEffect(() => {
      localStorage.setItem('enforceShiftLogic', enforceShiftLogic.toString());
  }, [enforceShiftLogic]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Persist Active Shift
  useEffect(() => {
      localStorage.setItem('activeShift', JSON.stringify(activeShift));
  }, [activeShift]);

  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES[0]);
  
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

  // --- UI State: Custom Alert Modal ---
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // --- Printing State ---
  const [orderToPrint, setOrderToPrint] = useState<Order | null>(null);
  const [printView, setPrintView] = useState<'DELIVERY' | 'KITCHEN'>('DELIVERY');

  // --- Processing State ---
  const [isProcessing, setIsProcessing] = useState(false);
  
  // --- Logo State ---
  const [logoError, setLogoError] = useState(false);

  // --- Handle Online Mode Toggle ---
  useEffect(() => {
      // Sync global offline state across all services
      setForceOffline(!isOnlineMode);
      setStaffForceOffline(!isOnlineMode);
      setInventoryForceOffline(!isOnlineMode);
      
      // Re-subscribe when mode changes to refresh data sources
      const unsubscribeOrders = subscribeToOrders((updatedOrders) => {
          setOrders(updatedOrders);
      });
      const unsubscribeEmployees = subscribeToEmployees((items) => {
          setEmployees(items);
      });
      const unsubscribeBlocked = subscribeToBlockedItems((items) => {
          setBlockedItems(items);
      });

      return () => {
          unsubscribeOrders();
          unsubscribeEmployees();
          unsubscribeBlocked();
      };
  }, [isOnlineMode]);

  // --- Order Type Effect ---
  // Reset fee when switching to Pickup
  useEffect(() => {
      if (orderType === 'PICKUP') {
          setDeliveryFee(0);
      }
  }, [orderType]);

  // --- Availability Logic Helper ---
  const getProductAvailability = (product: Product): { available: boolean; missingIngredient?: string } => {
      // 1. Check if the product name itself is blocked (e.g. "Coca-Cola")
      if (blockedItems.includes(product.sabor)) {
          return { available: false, missingIngredient: product.sabor };
      }

      // 2. Check if any ingredient is blocked
      if (product.ingredientes) {
          const missing = product.ingredientes.find(ing => blockedItems.includes(ing));
          if (missing) {
              return { available: false, missingIngredient: missing };
          }
      }
      
      return { available: true };
  };

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
          
          // Price check approximation
          const price = p.preco || (p.tamanhos ? p.tamanhos[0].preco : 0);
          const matchesPrice = price <= searchPriceMax;

          return matchesTerm && matchesCat && matchesPrice;
      });
  }, [isSearchOpen, globalSearchTerm, searchCategoryFilter, searchPriceMax]);

  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  }, [cart]);

  // Calculate Discount Amount
  const calculatedDiscount = useMemo(() => {
      const val = parseFloat(discountValue);
      if (isNaN(val) || val <= 0) return 0;

      if (discountType === 'FIXED') {
          return Math.min(val, cartSubtotal); // Cannot exceed subtotal
      } else {
          // Percentage
          const percent = Math.min(val, 100);
          return (cartSubtotal * percent) / 100;
      }
  }, [discountValue, discountType, cartSubtotal]);

  // Total Calculation: Subtotal - Discount + Delivery
  const cartTotal = Math.max(0, cartSubtotal - calculatedDiscount + deliveryFee);

  // Builder Logic
  const allPizzaProducts = useMemo(() => PRODUCTS.filter(p => p.tamanhos && p.tamanhos.length > 0), []);

  const availableFlavorsForModal = useMemo(() => {
    if (!selectedSize) return [];
    return allPizzaProducts.filter(p => {
      const hasSize = p.tamanhos?.some(t => t.pedaços === selectedSize);
      const matchesSearch = p.sabor.toLowerCase().includes(flavorSearch.toLowerCase());
      // Filter out blocked flavors in the builder too
      const { available } = getProductAvailability(p);
      return hasSize && matchesSearch && available;
    });
  }, [allPizzaProducts, selectedSize, flavorSearch, blockedItems]); // Added blockedItems dep

  const maxFlavors = useMemo(() => {
    if (!selectedSize) return 1;
    return selectedSize === 4 ? 2 : 4;
  }, [selectedSize]);

  // --- Actions ---

  const handleSaveSettings = () => {
      localStorage.setItem('deliveryTimeConfig', deliveryTimeConfig.toString());
      localStorage.setItem('pickupTimeConfig', pickupTimeConfig.toString());
      localStorage.setItem('sessionTimeoutMinutes', sessionTimeoutMinutes.toString());
      setIsSettingsOpen(false);
  };

  const handleLogout = () => {
      logout();
      setCurrentUser(null);
      // We do NOT reset order anymore on logout to persist state, but if desired:
      // resetOrder(); 
  };

  // Handle Phone Change & Lookup
  const handlePhoneChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setCustomer(prev => ({ ...prev, phone: val }));
      
      if (val.length >= 8) {
          // Debounce could be added here, but direct call for simplicity in this structure
          const { customer: found, orderCount } = await findCustomerHistory(val);
          if (found) {
              setCustomer({
                  ...found,
                  phone: val, // Keep current phone input
                  orderCount: orderCount
              });
              setCustomerStatus('FOUND');
          } else {
              setCustomerStatus('NEW');
              setCustomer(prev => ({ ...prev, orderCount: 0 }));
          }
      } else {
          setCustomerStatus('IDLE');
      }
  };

  const handleProductClick = (product: Product) => {
    const { available, missingIngredient } = getProductAvailability(product);
    
    if (!available) {
        setAlertMessage(`Produto indisponível!\nEm falta: ${missingIngredient}`);
        return;
    }

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
      // Logic to find if item exists to group it
      const existingItemIndex = prev.findIndex(item => isSameItem(item, product, price, size, flavors));

      if (existingItemIndex > -1) {
          // Clone array to treat it immutably
          const newCart = [...prev];
          newCart[existingItemIndex] = {
              ...newCart[existingItemIndex],
              quantity: newCart[existingItemIndex].quantity + 1
          };
          return newCart;
      }

      // If not found, add new
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

  const decreaseQuantity = (id: string) => {
      setCart(prev => {
          return prev.map(item => {
              if (item.id === id) {
                  return { ...item, quantity: Math.max(1, item.quantity - 1) };
              }
              return item;
          });
      });
  };

  const increaseQuantity = (id: string) => {
      setCart(prev => {
          return prev.map(item => {
              if (item.id === id) {
                  return { ...item, quantity: item.quantity + 1 };
              }
              return item;
          });
      });
  };

  const handleUpdateStatus = async (orderId: number, newStatus: OrderStatus, cancelReason?: string, driverName?: string, canceledBy?: string) => {
      try {
        await updateOrderStatus(orderId, newStatus, cancelReason, driverName, canceledBy);
        // State update happens automatically via the useEffect subscription
      } catch (error) {
        setAlertMessage("Erro ao atualizar status. Verifique sua conexão.");
        console.error(error);
      }
  };

  const resetOrder = () => {
    setCart([]);
    setCustomer({ name: '', phone: '', address: '', neighborhood: '', complement: '', orderCount: 0 });
    setCustomerStatus('IDLE');
    setDeliveryFee(0);
    setPaymentMethod('DINHEIRO');
    setChangeFor('');
    setDiscountValue('');
    setDiscountType('FIXED');
    setOrderToPrint(null);
  };

  // --- REPEAT ORDER LOGIC (For CRM) ---
  const handleRepeatOrder = (order: Order) => {
      // 1. Set Customer Data (Use what's in the order to ensure match)
      setCustomer({
          ...order.customer,
          // If the order has older data, it might overwrite newer data in state, 
          // but usually repeating an order implies using that customer.
          // We keep orderCount from state if possible or rely on order.
      });
      setCustomerStatus('FOUND');
      setOrderType(order.type);
      setPaymentMethod(order.paymentMethod);
      if (order.type === 'DELIVERY') {
          setDeliveryFee(order.deliveryFee);
      } else {
          setDeliveryFee(0);
      }

      // 2. Clone Cart Items (Generate new IDs to avoid conflicts)
      const newCart = order.items.map(item => ({
          ...item,
          id: `${Date.now()}-${Math.random()}`
      }));
      setCart(newCart);

      // 3. Switch View
      setView('POS');
      setAlertMessage("Pedido carregado no carrinho! Verifique os dados e finalize.");
  };

  const handleFinishOrder = async () => {
    // 1. Validation Logic
    const errors: string[] = [];

    // Check Store Open Status
    if (!isStoreOpen) {
        errors.push("A LOJA ESTÁ FECHADA. Não é possível realizar pedidos.");
    }

    // --- NEW: Check for Shift Enforcement ---
    if (enforceShiftLogic && activeShift.length === 0) {
        errors.push("BLOQUEIO DE SEGURANÇA: Nenhum colaborador escalado para hoje.\nDesabilite o bloqueio no topo da tela ou faça a escala no CRM.");
    }

    if (cart.length === 0) {
        errors.push("O carrinho está vazio.");
    }
    if (!customer.name.trim()) {
        errors.push("O nome do cliente é obrigatório.");
    }
    if (!customer.phone.trim()) {
        errors.push("O telefone do cliente é obrigatório.");
    }
    
    // Conditional Validation based on Order Type
    if (orderType === 'DELIVERY') {
        if (!customer.address.trim()) {
            errors.push("O endereço é obrigatório para entregas.");
        }
        if (!customer.neighborhood?.trim()) {
            errors.push("O bairro é obrigatório para entregas.");
        }
        if (deliveryFee <= 0) {
            errors.push("A Taxa de Entrega é obrigatória para pedidos de entrega.");
        }
    }

    // Payment validation
    const changeVal = changeFor ? parseFloat(changeFor) : 0;
    
    if (paymentMethod === 'DINHEIRO') {
        if (!changeFor) {
            errors.push("O valor entregue pelo cliente ('Troco para') é obrigatório.");
        } else if (changeVal < cartTotal) {
            errors.push(`Valor do troco (R$ ${changeVal}) é menor que o total.`);
        }
    }

    if (errors.length > 0) {
        setAlertMessage("Não é possível finalizar o pedido:\n\n" + errors.map(e => "• " + e).join("\n"));
        return;
    }

    setIsProcessing(true);

    try {
        // Increment order count for this new order locally for the receipt/order data
        const newOrderCount = (customer.orderCount || 0) + 1;

        // Calculate deadline based on Order Type
        const timeConfig = orderType === 'PICKUP' ? pickupTimeConfig : deliveryTimeConfig;
        const deadline = Date.now() + (timeConfig * 60 * 1000);

        // 2. Create Order Object
        const orderData = {
            date: new Date().toLocaleString('pt-BR'),
            timestamp: Date.now(),
            deadline: deadline,
            customer: { 
                ...customer,
                orderCount: newOrderCount 
            },
            items: [...cart],
            subtotal: cartSubtotal,
            deliveryFee: deliveryFee,
            discount: calculatedDiscount,
            total: cartTotal,
            paymentMethod: paymentMethod,
            changeFor: paymentMethod === 'DINHEIRO' && changeFor ? parseFloat(changeFor) : undefined,
            status: 'CONFIRMED' as OrderStatus,
            type: orderType,
            operatorName: currentUser?.name // Record who created the order
        };

        // 3. Send to Firebase (or LocalStorage based on mode/timeout)
        // CRITICAL: We prioritize Order Creation. Customer CRM update happens AFTER to avoid blocking.
        const createdOrder = await createOrder(orderData);

        // 4. Set Receipt Modal (INTERNAL POPUP) - IMMEDIATE
        setOrderToPrint(createdOrder); 
        setPrintView('DELIVERY'); // Reset to delivery view default
        setIsProcessing(false); // Stop loading immediately so user sees the receipt

        // 5. Sync Customer to Database (CRM) - Fire and Forget (Async)
        // This runs in background. If it fails, it doesn't matter for the current sale.
        saveOrUpdateCustomer(customer, cartTotal).catch(e => console.warn("Background CRM update failed", e));
        
    } catch (error) {
        console.error("Order creation failed:", error);
        setAlertMessage("Erro ao salvar o pedido. Tente novamente.");
        setIsProcessing(false);
    } 
  };

  const handlePrintFromKanban = (order: Order) => {
      setOrderToPrint(order);
      setPrintView('DELIVERY'); // Reset to delivery view default
  };

  const triggerSystemPrint = () => {
      window.print();
  };

  const handleCloseReceiptModal = () => {
      setOrderToPrint(null);
      // Logic: If there is still a cart, it means we came from the POS flow.
      // So closing the modal implies "Finishing" the flow -> Reset.
      // If the cart is empty (e.g., viewed from Kanban), we just close the modal.
      if (cart.length > 0) {
          resetOrder();
      }
  };

  // --- Export Offline Data to CSV ---
  const handleExportOfflineCSV = () => {
      const localOrders = getLocalOrders();
      if (localOrders.length === 0) {
          setAlertMessage("Não há pedidos offline para exportar.");
          return;
      }

      const headers = [
          "ID", "Data", "Hora", "Cliente", "Telefone", "Bairro", "Endereço", "Complemento", "Itens", "Subtotal", "Desconto", "Taxa Entrega", "Total", "Pagamento", "Status"
      ];

      const rows = localOrders.map(o => {
          const itemsString = o.items.map(i => {
              const name = i.flavors && i.flavors.length > 1 ? `Pizza ${i.flavors.length} Sabores` : i.product.sabor;
              return `${i.quantity}x ${name} (${i.observation || ''})`;
          }).join(" | ");

          const dateObj = new Date(o.timestamp);
          return [
              o.id,
              dateObj.toLocaleDateString('pt-BR'),
              dateObj.toLocaleTimeString('pt-BR'),
              `"${o.customer.name.replace(/"/g, '""')}"`,
              `"${o.customer.phone}"`,
              `"${o.customer.neighborhood || ''}"`,
              `"${o.customer.address.replace(/"/g, '""')}"`,
              `"${o.customer.complement || ''}"`,
              `"${itemsString.replace(/"/g, '""')}"`,
              o.subtotal.toFixed(2).replace('.', ','),
              (o.discount || 0).toFixed(2).replace('.', ','),
              o.deliveryFee.toFixed(2).replace('.', ','),
              o.total.toFixed(2).replace('.', ','),
              o.paymentMethod,
              o.status
          ].join(';');
      });

      const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(";") + "\n" + rows.join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `pedidos_offline_backup.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // --- RENDER START ---

  // 1. Auth Check
  if (!currentUser) {
      return <Login onLoginSuccess={setCurrentUser} />;
  }

  // Helper to render current view content
  const renderCurrentView = () => {
      if (view === 'CRM') {
          return (
            <CRM 
                orders={orders} 
                employees={employees}
                activeShift={activeShift}
                onUpdateActiveShift={setActiveShift}
                onBack={() => setView('POS')} 
                initialTab={crmInitialTab}
                onRepeatOrder={handleRepeatOrder} // Pass function to CRM
            />
          );
      }

      if (view === 'KANBAN') {
          return (
            <Kanban 
                orders={orders} 
                employees={employees}
                activeShift={activeShift}
                onUpdateStatus={handleUpdateStatus} 
                onPrintOrder={handlePrintFromKanban} 
                onBack={() => setView('POS')} 
                onRegisterDriver={() => {
                    setCrmInitialTab('STAFF');
                    setView('CRM');
                }}
                currentUser={currentUser}
            />
          );
      }

      if (view === 'INVENTORY') {
          return <Inventory products={PRODUCTS} blockedItems={blockedItems} onBack={() => setView('POS')} />;
      }

      if (view === 'USERS') {
          return <UserManagement onBack={() => setView('POS')} />;
      }

      // Default POS View
      return (
        <div className="flex flex-col lg:flex-row overflow-hidden h-full relative">
            
            {/* Store Closed Overlay */}
            {!isStoreOpen && !dismissedStoreClosed && (
                <div className="absolute inset-0 z-40 bg-gray-900/50 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-auto">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center animate-fade-in border-4 border-red-500 max-w-md text-center mx-4">
                        <Lock className="text-red-500 w-16 h-16 mb-4" />
                        <h2 className="text-3xl font-black text-red-600 uppercase tracking-widest mb-2">LOJA FECHADA</h2>
                        <p className="text-gray-600 dark:text-gray-300 font-bold mb-6">
                            O sistema está bloqueado para novos pedidos.<br/>
                            Para realizar vendas, abra a loja no menu superior.
                        </p>
                        <button 
                            onClick={() => setDismissedStoreClosed(true)}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-transform transform active:scale-95 flex items-center gap-2"
                        >
                            <CheckCircle size={20} />
                            ENTENDIDO
                        </button>
                        <p className="mt-4 text-xs text-gray-400">Pressione ESC para fechar</p>
                    </div>
                </div>
            )}

            {/* Header / Main Area Wrapper */}
            <div className={`flex-1 flex flex-col h-full overflow-hidden relative ${!isStoreOpen ? 'pointer-events-none' : ''}`}>
                <header className="bg-wine dark:bg-wine p-3 shadow-lg flex flex-wrap items-center justify-between z-10 shrink-0 border-b-4 border-gold pointer-events-auto">
                  <div className="flex items-center gap-3">
                     <div className="w-12 h-12 md:w-14 md:h-14 bg-white rounded-full border-2 border-gold flex items-center justify-center overflow-hidden shrink-0 shadow-md relative group">
                         {!logoError ? (
                             <img 
                                src="/logo.png" 
                                alt="Logo" 
                                className="w-full h-full object-cover"
                                onError={() => setLogoError(true)}
                             />
                         ) : (
                             <div className="w-full h-full flex flex-col items-center justify-center bg-wine text-gold">
                                <Pizza size={24} />
                             </div>
                         )}
                    </div>
                    <div>
                      <h1 className="font-serif text-xl md:text-2xl font-bold tracking-wide text-gold truncate">Divina Pizza</h1>
                      <div className="flex items-center gap-2">
                          <p className="text-[9px] md:text-[10px] text-orange font-bold uppercase tracking-widest hidden sm:block">e Pastéis</p>
                          <span className="text-[10px] text-gray-300 hidden sm:inline">|</span>
                          <span className="text-[10px] text-white flex items-center gap-1"><User size={10}/> {currentUser.name.split(' ')[0]}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Controls / Icons */}
                  <div className="flex gap-2 items-center flex-wrap justify-end">
                     
                     <ClockWidget />

                     {/* Store Open/Close Toggle */}
                     <button 
                        onClick={() => setIsStoreOpen(!isStoreOpen)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all shadow-md ${isStoreOpen ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white animate-pulse'}`}
                        title={isStoreOpen ? "Loja Aberta (Clique para fechar)" : "Loja Fechada (Clique para abrir)"}
                     >
                         {isStoreOpen ? <Unlock size={16} /> : <Lock size={16} />}
                         <span className="hidden xl:inline">{isStoreOpen ? 'Aberta' : 'Fechada'}</span>
                     </button>

                     <button 
                         onClick={() => setIsOnlineMode(!isOnlineMode)}
                         className={`flex items-center gap-2 px-2 py-2 rounded-lg text-sm font-bold transition-all shadow-md ${isOnlineMode ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-600 hover:bg-gray-700 text-gray-200'}`}
                         title={isOnlineMode ? "Modo Online (Firebase)" : "Modo Offline (LocalStorage)"}
                     >
                         {isOnlineMode ? <Wifi size={16} /> : <WifiOff size={16} />}
                         <span className="hidden xl:inline">{isOnlineMode ? 'Online' : 'Offline'}</span>
                     </button>

                     {(!isOnlineMode || getLocalOrders().length > 0) && (
                         <button 
                            onClick={handleExportOfflineCSV}
                            className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg flex items-center gap-2 transition-all shadow-md font-bold"
                            title="Baixar Backup Offline (CSV)"
                         >
                             <Download size={16} />
                         </button>
                     )}

                     {/* Shift Enforcement Toggle */}
                     <button 
                        onClick={() => setEnforceShiftLogic(!enforceShiftLogic)}
                        className={`p-2 rounded-lg flex items-center gap-2 transition-all shadow-md font-bold text-xs ${enforceShiftLogic ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white animate-pulse'}`}
                        title={enforceShiftLogic ? "Bloqueio de Escala ATIVO: Exige colaboradores" : "Bloqueio de Escala DESATIVADO: Permite vender sem equipe (Modo Teste)"}
                     >
                         {enforceShiftLogic ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
                         <span className="hidden xl:inline">{enforceShiftLogic ? 'Escala Req.' : 'Sem Escala'}</span>
                     </button>

                     {blockedItems.length > 0 && (
                         <button 
                            onClick={() => setView('INVENTORY')}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-all animate-pulse shadow-md border border-red-400"
                            title="Itens em falta!"
                         >
                             <AlertTriangle className="w-5 h-5" />
                             <span className="font-bold">{blockedItems.length}</span>
                         </button>
                     )}

                     <button
                        onClick={() => setDarkMode(!darkMode)}
                        className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg flex items-center transition-all"
                        title={darkMode ? "Modo Claro" : "Modo Escuro"}
                     >
                         {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                     </button>
                     
                     {currentUser.role === 'ADMIN' && (
                         <button 
                            onClick={() => setIsSettingsOpen(true)}
                            className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-lg flex items-center gap-2 transition-all shadow-md font-bold border border-gray-500"
                            title="Configurações Gerais"
                         >
                             <Settings className="w-5 h-5" />
                         </button>
                     )}

                     <button 
                        onClick={() => setIsSearchOpen(true)}
                        className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg flex items-center gap-2 transition-all"
                        title="Buscar Produtos"
                     >
                         <Search className="w-5 h-5" />
                         <span className="hidden xl:inline text-sm font-bold">Buscar</span>
                     </button>
                     
                     <div className="hidden md:flex gap-2">
                        <button 
                            onClick={() => setView('INVENTORY')}
                            className="bg-purple-700 hover:bg-purple-800 text-white p-2 rounded-lg flex items-center gap-2 transition-all shadow-md font-bold"
                            title="Controle de Estoque"
                        >
                            <PackageOpen className="w-5 h-5" />
                            <span className="hidden lg:inline text-sm">Estoque</span>
                        </button>
                        <button 
                            onClick={() => {
                                setCrmInitialTab(undefined);
                                setView('KANBAN');
                            }}
                            className="bg-orange hover:bg-orange-light text-white p-2 rounded-lg flex items-center gap-2 transition-all shadow-md font-bold"
                            title="Acompanhamento (Cozinha)"
                        >
                            <ChefHat className="w-5 h-5" />
                            <span className="hidden lg:inline text-sm">Pedidos</span>
                        </button>
                        <button 
                            onClick={() => {
                                setCrmInitialTab('DASHBOARD');
                                setView('CRM');
                            }}
                            className="bg-gold hover:bg-gold-dark text-wine p-2 rounded-lg flex items-center gap-2 transition-all shadow-md font-bold"
                            title="Gestão Financeira"
                        >
                            <BarChart2 className="w-5 h-5" />
                            <span className="hidden lg:inline text-sm">Gestão</span>
                        </button>
                        
                        {currentUser.role === 'ADMIN' && (
                            <button 
                                onClick={() => setView('USERS')}
                                className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg flex items-center gap-2 transition-all shadow-md font-bold"
                                title="Gerenciar Usuários"
                            >
                                <User className="w-5 h-5" />
                            </button>
                        )}
                     </div>

                     {/* Mobile Menu Trigger (could be expanded) */}
                     <div className="flex md:hidden gap-1">
                        <button onClick={() => setView('KANBAN')} className="bg-orange p-2 rounded text-white"><ChefHat size={16}/></button>
                        <button onClick={() => setView('CRM')} className="bg-gold p-2 rounded text-wine"><BarChart2 size={16}/></button>
                     </div>

                     <button 
                        onClick={handleLogout}
                        className="bg-red-800 hover:bg-red-700 text-white p-2 rounded-lg flex items-center gap-2 transition-all shadow-md font-bold ml-1"
                        title="Sair do Sistema"
                     >
                         <LogOut className="w-5 h-5" />
                     </button>
                  </div>
                </header>

                {/* Categories */}
                <nav className="bg-wine-light dark:bg-gray-800 text-white overflow-x-auto shrink-0 shadow-md scrollbar-hide border-b border-white/10">
                  <div className="flex px-2 min-w-max">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-4 md:px-5 py-3 font-bold text-xs md:text-sm uppercase tracking-wider transition-colors border-b-4 ${
                          activeCategory === cat 
                            ? 'border-gold text-gold bg-wine/50 dark:bg-gray-700' 
                            : 'border-transparent text-gray-300 hover:text-white hover:bg-wine/30'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </nav>

                {/* Product Grid */}
                <main className="flex-1 overflow-y-auto p-4 bg-gray-100/50 dark:bg-gray-900 scroll-smooth">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-serif text-wine dark:text-gold border-b-2 border-orange/50 pb-1 inline-block">
                        {activeCategory}
                    </h2>
                  </div>
                  
                  {/* RESPONSIVE GRID CONFIGURATION */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-20">
                    {filteredProducts.map((product, idx) => {
                      const { available, missingIngredient } = getProductAvailability(product);
                      
                      return (
                        <div 
                          key={`${product.sabor}-${idx}`} 
                          className={`
                            bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden group relative
                            ${available 
                                ? 'hover:shadow-lg hover:border-orange dark:hover:border-orange cursor-pointer transition-all duration-200' 
                                : 'opacity-60 cursor-not-allowed grayscale-[0.8]'}
                          `}
                          onClick={() => handleProductClick(product)}
                        >
                          {!available && (
                              <div className="absolute inset-0 bg-white/50 dark:bg-black/50 z-10 flex items-center justify-center p-4 text-center">
                                  <div className="bg-red-600 text-white px-3 py-1 rounded shadow-lg transform -rotate-12 font-bold text-sm border-2 border-white">
                                      Falta: {missingIngredient}
                                  </div>
                              </div>
                          )}

                          <div className="p-4 flex-1">
                            <h3 className="font-serif text-lg text-wine dark:text-gray-100 font-bold leading-tight group-hover:text-orange transition-colors">
                              {product.sabor}
                            </h3>
                            {product.ingredientes && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
                                {product.ingredientes.join(', ')}
                              </p>
                            )}
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                            <span className="text-sm font-bold text-leaf dark:text-green-400">
                              {product.tamanhos ? 'A partir de ' + formatCurrency(product.tamanhos[0].preco) : formatCurrency(product.preco || 0)}
                            </span>
                            {available ? (
                                <Plus className="w-5 h-5 text-wine dark:text-gray-300 group-hover:scale-110 transition-transform" />
                            ) : (
                                <Ban className="w-5 h-5 text-red-500" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </main>
            </div>

            {/* --- Sidebar Cart --- */}
            <aside className={`w-full lg:w-[350px] xl:w-[400px] bg-white dark:bg-gray-800 shadow-2xl flex flex-col h-[45vh] lg:h-full z-20 border-t lg:border-t-0 lg:border-l border-gray-300 dark:border-gray-700 relative transition-colors duration-200 ${!isStoreOpen ? 'pointer-events-none' : ''}`}>
                {/* Header */}
                <div className="bg-wine dark:bg-wine p-3 flex items-center justify-between shadow-md shrink-0">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-gold" />
                    <h2 className="font-serif text-lg font-bold text-white">Pedido Atual</h2>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 font-bold ${isOnlineMode ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
                       {isProcessing ? 'Processando...' : `${isOnlineMode ? 'Online' : 'Offline'}: #${orders.length > 0 ? orders[0].id + 1 : 1001}`}
                  </span>
                </div>

                {/* Cart Items List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50 dark:bg-gray-900/50">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 opacity-60">
                      <ShoppingCart size={48} strokeWidth={1} />
                      <p className="mt-2 font-serif text-lg">Sem itens</p>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div key={item.id} className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 group">
                        {/* ... Cart Item Render ... */}
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-lg text-wine dark:text-orange">{item.quantity}x</span>
                                    <h4 className="font-bold text-gray-700 dark:text-gray-200 text-sm">
                                        {formatCartItemTitle(item)}
                                    </h4>
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-6">
                                    {/* Render Flavors List for Pizzas (Always) */}
                                    {item.selectedSize && item.flavors ? (
                                        <div className="mt-1 pl-2 border-l-2 border-orange/30">
                                            {item.flavors.map((f, i) => {
                                              const total = item.flavors!.length;
                                              const fraction = total > 1 
                                                ? (total === 2 ? '1/2' : total === 3 ? '1/3' : `1/${total}`) 
                                                : '';
                                              return (
                                                <div key={i} className="leading-tight py-0.5">
                                                    {fraction && <span className="font-bold mr-1">{fraction}</span>}
                                                    {f.sabor}
                                                </div>
                                              );
                                            })}
                                        </div>
                                    ) : item.product.categoria.toLowerCase().includes('pastel') ? (
                                        // NEW PASTEL LAYOUT IN CART
                                        <div className="mt-1 pl-2 border-l-2 border-orange/30">
                                            <div className="leading-tight py-0.5 font-medium text-gray-700 dark:text-gray-300">
                                                {item.product.sabor}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <span className="font-bold text-gray-800 dark:text-white">{formatCurrency(item.price * item.quantity)}</span>
                                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded p-0.5">
                                    <button onClick={() => decreaseQuantity(item.id)} className="p-1 hover:bg-white dark:hover:bg-gray-600 rounded text-gray-600 dark:text-gray-300">
                                        <Minus size={14}/>
                                    </button>
                                    <button onClick={() => increaseQuantity(item.id)} className="p-1 hover:bg-white dark:hover:bg-gray-600 rounded text-gray-600 dark:text-gray-300">
                                        <Plus size={14}/>
                                    </button>
                                    <button onClick={() => removeFromCart(item.id)} className="p-1 text-red-500 hover:bg-white dark:hover:bg-gray-600 rounded ml-1">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-dashed border-gray-100 dark:border-gray-700">
                            <input 
                                type="text" 
                                placeholder="Observação (ex: sem cebola)"
                                value={item.observation}
                                onChange={(e) => updateCartItemObservation(item.id, e.target.value)}
                                className="w-full text-xs bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 focus:border-orange outline-none py-1 text-gray-600 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-500 italic"
                            />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Sidebar Footer */}
                <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_10px_-4px_rgba(0,0,0,0.1)] p-4 shrink-0 z-30">
                  
                  {/* Order Type Toggle */}
                  <div className="bg-gray-100 dark:bg-gray-700 p-1 rounded-lg flex mb-3">
                      <button 
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-sm font-bold transition-all ${orderType === 'DELIVERY' ? 'bg-white dark:bg-gray-600 text-wine dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                        onClick={() => setOrderType('DELIVERY')}
                      >
                          <Bike size={16}/> Entrega
                      </button>
                      <button 
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-sm font-bold transition-all ${orderType === 'PICKUP' ? 'bg-white dark:bg-gray-600 text-wine dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                        onClick={() => setOrderType('PICKUP')}
                      >
                          <Store size={16}/> Retirada
                      </button>
                  </div>

                  {/* Customer */}
                  <div className="mb-2 space-y-2">
                     <div className="flex gap-2 relative">
                         <input 
                           type="tel" placeholder="Telefone (Buscar) *" 
                           value={customer.phone} 
                           onChange={handlePhoneChange}
                           className={`w-1/3 bg-gray-50 dark:bg-gray-700 border rounded px-2 py-1.5 text-sm dark:text-white focus:ring-1 focus:ring-orange outline-none ${!customer.phone && cart.length > 0 ? 'border-red-200' : 'border-gray-200 dark:border-gray-600'}`}
                         />
                         <input 
                           type="text" placeholder="Nome do Cliente *" 
                           value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})}
                           className={`flex-1 bg-gray-50 dark:bg-gray-700 border rounded px-2 py-1.5 text-sm dark:text-white focus:ring-1 focus:ring-orange outline-none ${!customer.name && cart.length > 0 ? 'border-red-200' : 'border-gray-200 dark:border-gray-600'}`}
                         />
                     </div>
                     
                     {/* Search Status / Order Count */}
                     {customerStatus === 'FOUND' && (
                         <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
                             <Check size={12}/> Cliente Encontrado! {customer.orderCount ? `(${customer.orderCount} pedidos anteriores)` : ''}
                         </div>
                     )}
                     {customerStatus === 'NEW' && (
                         <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                             <User size={12}/> Novo Cliente
                         </div>
                     )}
                     
                     {/* Address Input - Conditional */}
                     {orderType === 'DELIVERY' ? (
                        <div className="space-y-2 animate-fade-in">
                            <div className="flex gap-2">
                                <input 
                                    type="text" placeholder="Bairro *" 
                                    value={customer.neighborhood || ''} 
                                    onChange={e => setCustomer({...customer, neighborhood: e.target.value})}
                                    className={`w-1/2 bg-gray-50 dark:bg-gray-700 border rounded px-2 py-1.5 text-sm dark:text-white focus:ring-1 focus:ring-orange outline-none ${!customer.neighborhood && cart.length > 0 ? 'border-red-200' : 'border-gray-200 dark:border-gray-600'}`}
                                />
                                 <input 
                                    type="text" placeholder="Rua e Número *" 
                                    value={customer.address} onChange={e => setCustomer({...customer, address: e.target.value})}
                                    className={`flex-1 bg-gray-50 dark:bg-gray-700 border rounded px-2 py-1.5 text-sm dark:text-white focus:ring-1 focus:ring-orange outline-none ${!customer.address && cart.length > 0 ? 'border-red-200' : 'border-gray-200 dark:border-gray-600'}`}
                                />
                            </div>
                            <div>
                                 <input 
                                    type="text" placeholder="Complemento (Opcional)" 
                                    value={customer.complement || ''} 
                                    onChange={e => setCustomer({...customer, complement: e.target.value})}
                                    className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-sm dark:text-white focus:ring-1 focus:ring-orange outline-none"
                                />
                            </div>
                        </div>
                     ) : (
                        <div className="flex gap-2 animate-fade-in opacity-50 select-none">
                            <input disabled type="text" value="Retirada no Balcão (Endereço não necessário)" className="flex-1 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 italic text-center" />
                        </div>
                     )}
                  </div>

                  {/* Discount Section */}
                  <div className="mb-2 p-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                       <div className="flex items-center gap-2 mb-1">
                           <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Desconto Manual</span>
                       </div>
                       <div className="flex gap-2">
                           <div className="flex-1 relative">
                               <input 
                                  type="number"
                                  placeholder="Valor" 
                                  value={discountValue}
                                  onChange={e => setDiscountValue(e.target.value)}
                                  className="w-full pl-2 pr-2 py-1 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 dark:text-white rounded outline-none focus:ring-1 focus:ring-orange"
                               />
                           </div>
                           <div className="flex bg-gray-200 dark:bg-gray-800 rounded p-0.5 shrink-0">
                               <button 
                                  onClick={() => setDiscountType('FIXED')}
                                  className={`px-2 py-1 rounded text-xs font-bold transition-all ${discountType === 'FIXED' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                               >
                                   <DollarSign size={14}/>
                               </button>
                               <button 
                                  onClick={() => setDiscountType('PERCENT')}
                                  className={`px-2 py-1 rounded text-xs font-bold transition-all ${discountType === 'PERCENT' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                               >
                                   <Percent size={14}/>
                               </button>
                           </div>
                       </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div className="mb-3">
                     <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1 block">Forma de Pagamento</label>
                     <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'DINHEIRO', label: 'Dinheiro', icon: Banknote },
                          { id: 'PIX', label: 'Pix', icon: Smartphone },
                          { id: 'CREDITO', label: 'Crédito', icon: CreditCard },
                          { id: 'DEBITO', label: 'Débito', icon: CreditCard },
                          { id: 'REFEICAO', label: 'Refeição', icon: Utensils },
                          { id: 'IFOOD', label: 'iFood Online', icon: Globe },
                          { id: 'FIADO', label: 'Fiado', icon: NotebookPen } // New FIADO button
                        ].map( method => (
                          <button 
                            key={method.id}
                            onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                            className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded border text-[10px] font-bold transition-all ${paymentMethod === method.id ? 'bg-wine text-gold border-wine' : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                          >
                            <method.icon size={12} /> {method.label}
                          </button>
                        ))}
                     </div>
                     {/* Change Input (Troco) */}
                     {paymentMethod === 'DINHEIRO' && (
                         <div className="mt-2 flex flex-col gap-2 animate-fade-in">
                            <div className="flex gap-2 items-center">
                                <label className="text-xs font-bold text-gray-600 dark:text-gray-300">Troco p/:</label>
                                <div className="relative flex-1">
                                    <span className="absolute left-2 top-1.5 text-gray-400 text-xs">R$</span>
                                    <input 
                                        type="number" 
                                        value={changeFor}
                                        onChange={(e) => setChangeFor(e.target.value)}
                                        className={`w-full pl-6 pr-2 py-1 text-sm bg-white dark:bg-gray-700 border rounded focus:ring-1 focus:ring-orange outline-none dark:text-white ${!changeFor ? 'border-red-300' : 'border-gray-300 dark:border-gray-600'}`}
                                        placeholder="Valor entregue..."
                                    />
                                </div>
                             </div>
                             
                             {/* Big Box for Change Display */}
                             {changeFor && parseFloat(changeFor) >= cartTotal ? (
                                 <div className="flex justify-between items-center bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 p-3 rounded-lg shadow-inner">
                                     <span className="text-xs font-bold text-green-800 dark:text-green-300 uppercase">Troco a devolver:</span>
                                     <span className="text-xl font-bold text-green-800 dark:text-green-300">{formatCurrency(parseFloat(changeFor) - cartTotal)}</span>
                                 </div>
                             ) : changeFor ? (
                                 <div className="text-xs text-red-500 font-bold text-center">Valor menor que o total!</div>
                             ) : null}
                         </div>
                     )}
                  </div>

                  {/* Delivery Fee Slider */}
                  <div className={`mb-3 transition-opacity ${orderType === 'PICKUP' ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                      <div className="flex justify-between text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                          <span className="flex items-center gap-1"><Bike size={12}/> Taxa de Entrega {orderType === 'DELIVERY' && deliveryFee === 0 && <span className="text-red-500 ml-1 text-[10px]">(Obrigatório)</span>}</span>
                          <span className={`${deliveryFee === 0 && orderType === 'DELIVERY' ? 'text-red-500' : 'text-orange'}`}>{formatCurrency(deliveryFee)}</span>
                      </div>
                      <input 
                        type="range" min="0" max="40" step="1" 
                        value={deliveryFee} 
                        onChange={(e) => setDeliveryFee(Number(e.target.value))}
                        className="w-full h-1 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-orange"
                      />
                  </div>

                  {/* Totals */}
                  <div className="space-y-1 mb-3 text-sm">
                     <div className="flex justify-between text-gray-500 dark:text-gray-400">
                         <span>Subtotal</span>
                         <span>{formatCurrency(cartSubtotal)}</span>
                     </div>
                     {calculatedDiscount > 0 && (
                         <div className="flex justify-between text-green-600 dark:text-green-400 font-bold">
                             <span>Desconto</span>
                             <span>- {formatCurrency(calculatedDiscount)}</span>
                         </div>
                     )}
                     <div className="flex justify-between text-gray-500 dark:text-gray-400">
                         <span>Entrega</span>
                         <span>{orderType === 'PICKUP' ? '--' : formatCurrency(deliveryFee)}</span>
                     </div>
                     <div className="flex justify-between text-xl font-bold text-wine dark:text-gold mt-2 border-t border-gray-200 dark:border-gray-700 pt-2">
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
                  
                  {/* Copyright Footer */}
                  <div className="mt-4 pt-2 text-center border-t border-dashed border-gray-200 dark:border-gray-700">
                      <p className="text-[9px] text-gray-400 dark:text-gray-500">Dev. by Tech&Store | Robson Rosa CEO</p>
                      <p className="text-[9px] text-gray-400 dark:text-gray-500 font-mono">(15) 98819-5768</p>
                  </div>
                </div>
            </aside>
        </div>
      );
  }

  // 3. Main Return with Global Modal Support
  return (
    <div className="h-dvh bg-cream dark:bg-gray-900 transition-colors duration-200 overflow-hidden">
        
        {/* Main Content - Hidden when Printing */}
        <div className="flex flex-col md:flex-row h-full w-full overflow-hidden print:hidden">
            {renderCurrentView()}
        </div>

        {/* --- Global Receipt Preview Modal --- */}
        {orderToPrint && (
            <div className="fixed inset-0 z-[100] bg-zinc-900/90 backdrop-blur-md flex justify-center items-center p-4">
                <div className="bg-transparent w-full flex flex-col items-center justify-center h-full max-h-screen">
                    
                    {/* Header Instructions */}
                    <div className="mb-4 text-center print:hidden flex flex-col items-center">
                        <h2 className="text-white text-2xl font-bold mb-1">Pedido #{orderToPrint.id} Realizado!</h2>
                        <p className="text-gray-400 text-sm mb-4">Escolha a via e clique em imprimir.</p>
                        
                        {/* Tab Selector */}
                        <div className="bg-gray-800 p-1 rounded-lg flex gap-1 mt-2 border border-gray-700">
                            <button 
                                onClick={() => setPrintView('DELIVERY')}
                                className={`px-4 py-2 rounded-md font-bold text-sm flex items-center gap-2 transition-all ${printView === 'DELIVERY' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                            >
                                <Bike size={16} /> Via Entrega (Cliente)
                            </button>
                            <button 
                                onClick={() => setPrintView('KITCHEN')}
                                className={`px-4 py-2 rounded-md font-bold text-sm flex items-center gap-2 transition-all ${printView === 'KITCHEN' ? 'bg-orange text-white shadow' : 'text-gray-400 hover:text-white'}`}
                            >
                                <ChefHat size={16} /> Via Cozinha
                            </button>
                        </div>
                    </div>

                    {/* Receipt Content Area - Centered and Scrollable */}
                    <div className="overflow-y-auto w-full flex justify-center mb-6 print:mb-0 print:overflow-visible custom-scrollbar">
                        <div className="shadow-2xl print:shadow-none bg-white">
                            {printView === 'DELIVERY' ? (
                                <Receipt 
                                    cart={orderToPrint.items}
                                    customer={orderToPrint.customer}
                                    subtotal={orderToPrint.subtotal}
                                    deliveryFee={orderToPrint.deliveryFee}
                                    discount={orderToPrint.discount}
                                    total={orderToPrint.total}
                                    paymentMethod={orderToPrint.paymentMethod}
                                    changeFor={orderToPrint.changeFor}
                                    orderId={orderToPrint.id}
                                    orderType={orderToPrint.type}
                                    deadline={orderToPrint.deadline}
                                />
                            ) : (
                                <KitchenReceipt 
                                    cart={orderToPrint.items}
                                    customer={orderToPrint.customer}
                                    orderId={orderToPrint.id}
                                    orderType={orderToPrint.type}
                                    date={orderToPrint.date}
                                    deadline={orderToPrint.deadline}
                                />
                            )}
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex gap-4 w-full max-w-xs print:hidden">
                        <button 
                            onClick={handleCloseReceiptModal}
                            className="flex-1 py-3 font-bold text-gray-300 border border-gray-600 rounded-xl hover:bg-gray-800 transition-colors"
                        >
                            {cart.length > 0 ? 'Concluir / Novo' : 'Fechar'}
                        </button>
                        <button 
                            onClick={triggerSystemPrint}
                            className={`flex-[2] py-3 font-bold text-white rounded-xl shadow-lg flex items-center justify-center gap-3 transition-transform transform active:scale-[0.98] ${printView === 'DELIVERY' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange hover:bg-orange-light'}`}
                        >
                            <Printer size={24} /> 
                            IMPRIMIR
                        </button>
                    </div>
                </div>
            </div>
        )}
      
        {/* Success Modal - REMOVED (Redundant) */}

        {/* Builder Modal */}
        {isBuilderOpen && currentBaseProduct && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
            <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-wine p-4 flex justify-between items-center text-white shrink-0">
                    <div>
                        <h3 className="font-bold text-lg">{currentBaseProduct.sabor}</h3>
                        <p className="text-xs opacity-80">Monte sua pizza</p>
                    </div>
                    <button onClick={() => setIsBuilderOpen(false)}><X/></button>
                </div>
                
                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1 bg-gray-50 dark:bg-gray-900">
                    {builderStep === 'SIZE' && (
                        <div className="space-y-4">
                            <h4 className="font-bold text-center text-gray-700 dark:text-gray-200">Escolha o Tamanho</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {currentBaseProduct.tamanhos?.map(t => (
                                    <button 
                                        key={t.pedaços}
                                        onClick={() => handleSizeSelect(t.pedaços)}
                                        className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border-2 border-transparent hover:border-orange flex flex-col items-center gap-2 transition-all group"
                                    >
                                        <div className="w-16 h-16 rounded-full bg-orange/10 text-orange font-bold flex items-center justify-center text-xl group-hover:bg-orange group-hover:text-white transition-colors">
                                            {t.pedaços}
                                        </div>
                                        <span className="font-bold text-gray-700 dark:text-gray-200">{t.pedaços} Pedaços</span>
                                        <span className="text-sm text-gray-500 font-bold">{formatCurrency(t.preco)}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {builderStep === 'FLAVORS' && (
                        <div className="h-full flex flex-col">
                            <div className="mb-4 text-center">
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Tamanho: <strong className="text-gray-800 dark:text-gray-200">{selectedSize} Pedaços</strong></p>
                                <div className="flex justify-center items-center gap-2 text-lg font-bold text-wine dark:text-gold">
                                    <span>{selectedFlavors.length}/{maxFlavors} Sabores</span>
                                </div>
                                <p className="text-xs text-gray-400">Preço final: média dos sabores</p>
                            </div>

                            {/* Selected Flavors List */}
                            <div className="flex flex-wrap gap-2 mb-4 justify-center">
                                {selectedFlavors.map((f, i) => (
                                    <div key={i} className="bg-orange/10 text-orange px-3 py-1 rounded-full flex items-center gap-2 text-sm font-bold border border-orange/20">
                                        <span>{i+1}. {f.sabor}</span>
                                        {i > 0 && <button onClick={() => handleRemoveFlavor(i)}><X size={14}/></button>}
                                    </div>
                                ))}
                            </div>

                            {/* Search Flavors */}
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar sabor..." 
                                    value={flavorSearch}
                                    onChange={e => setFlavorSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm outline-none focus:ring-1 focus:ring-orange"
                                    autoFocus
                                />
                            </div>

                            {/* Flavor List */}
                            <div className="grid grid-cols-1 gap-2 overflow-y-auto max-h-[300px]">
                                {availableFlavorsForModal.map(flavor => (
                                    <button 
                                        key={flavor.sabor}
                                        onClick={() => handleAddFlavor(flavor)}
                                        disabled={selectedFlavors.length >= maxFlavors}
                                        className={`text-left p-3 rounded-lg border flex justify-between items-center transition-all ${selectedFlavors.length >= maxFlavors ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800 border-transparent' : 'bg-white dark:bg-gray-700 hover:border-orange border-gray-200 dark:border-gray-600'}`}
                                    >
                                        <div>
                                            <span className="font-bold text-gray-700 dark:text-gray-200 block text-sm">{flavor.sabor}</span>
                                            <span className="text-xs text-gray-400">{flavor.ingredientes?.slice(0, 3).join(', ')}...</span>
                                        </div>
                                        <span className="font-bold text-gray-500 dark:text-gray-400 text-xs">
                                            {formatCurrency(getPriceForSize(flavor, selectedSize!))}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shrink-0">
                    {builderStep === 'SIZE' ? (
                        <button onClick={() => setIsBuilderOpen(false)} className="w-full py-3 text-gray-500 font-bold hover:bg-gray-200 rounded-lg">Cancelar</button>
                    ) : (
                        <div className="flex gap-3">
                            <button onClick={() => setBuilderStep('SIZE')} className="flex-1 py-3 text-gray-600 font-bold border border-gray-300 rounded-lg hover:bg-gray-100">Voltar</button>
                            <button 
                                    onClick={finishPizzaBuild} 
                                    disabled={selectedFlavors.length === 0}
                                    className={`flex-1 py-3 font-bold text-white rounded-lg shadow-lg flex items-center justify-center gap-2 ${selectedFlavors.length === 0 ? 'bg-gray-400' : 'bg-leaf hover:bg-green-700'}`}
                            >
                                <CheckCircle size={18}/> Adicionar
                            </button>
                        </div>
                    )}
                </div>
            </div>
            </div>
        )}

        {/* Search Modal */}
        {isSearchOpen && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 backdrop-blur-sm pt-20 print:hidden">
                <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 bg-wine text-white">
                        <Search className="w-6 h-6"/>
                        <input 
                            type="text" 
                            placeholder="Buscar produto por nome ou ingrediente..." 
                            value={globalSearchTerm}
                            onChange={e => setGlobalSearchTerm(e.target.value)}
                            className="flex-1 bg-transparent border-none outline-none text-white placeholder-white/50 text-lg font-bold"
                            autoFocus
                        />
                        <button onClick={() => setIsSearchOpen(false)}><X/></button>
                    </div>
                    
                    {/* Filters */}
                    <div className="p-2 bg-gray-100 dark:bg-gray-900 flex gap-2 overflow-x-auto">
                        <select 
                            value={searchCategoryFilter} 
                            onChange={e => setSearchCategoryFilter(e.target.value)}
                            className="bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold py-1 px-2 rounded border border-gray-300 dark:border-gray-600 outline-none"
                        >
                            <option value="Todas">Todas as Categorias</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-800">
                        {searchResults.length === 0 ? (
                            <div className="text-center text-gray-400 py-10">
                                Nenhum produto encontrado.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-2">
                                {searchResults.map((product, idx) => {
                                    const { available, missingIngredient } = getProductAvailability(product);
                                    return (
                                        <div 
                                            key={idx} 
                                            onClick={() => handleProductClick(product)}
                                            className={`p-3 rounded-lg border flex justify-between items-center transition-all group ${available ? 'bg-white dark:bg-gray-700 cursor-pointer hover:border-orange' : 'bg-gray-100 dark:bg-gray-800 opacity-60 cursor-not-allowed border-gray-200'}`}
                                        >
                                            <div>
                                                <h4 className="font-bold text-gray-800 dark:text-gray-200">{product.sabor}</h4>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{product.ingredientes?.join(', ')}</p>
                                                {!available && <span className="text-[10px] text-red-500 font-bold uppercase bg-red-100 px-1 rounded">Falta: {missingIngredient}</span>}
                                            </div>
                                            <div className="text-right">
                                                <span className="font-bold text-leaf dark:text-green-400 block">{product.tamanhos ? 'A partir de ' + formatCurrency(product.tamanhos[0].preco) : formatCurrency(product.preco || 0)}</span>
                                                <span className="text-[10px] text-gray-400 uppercase font-bold">{product.categoria}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* Settings Modal (Delivery Time & Session) */}
        {isSettingsOpen && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
                <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-xl p-6 shadow-2xl">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                        <Settings className="text-orange" /> Configurações do Sistema
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-600 dark:text-gray-300 mb-1">
                                <Bike size={14} className="inline mr-1" /> Tempo Entrega (min)
                            </label>
                            <input 
                                type="number" 
                                value={deliveryTimeConfig} 
                                onChange={(e) => setDeliveryTimeConfig(Number(e.target.value))}
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-lg font-bold text-center dark:bg-gray-700 dark:text-white" 
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-600 dark:text-gray-300 mb-1">
                                <Store size={14} className="inline mr-1" /> Tempo Retirada (min)
                            </label>
                            <input 
                                type="number" 
                                value={pickupTimeConfig} 
                                onChange={(e) => setPickupTimeConfig(Number(e.target.value))}
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-lg font-bold text-center dark:bg-gray-700 dark:text-white" 
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-600 dark:text-gray-300 mb-1">
                                <Lock size={14} className="inline mr-1" /> Tempo de Sessão (min)
                            </label>
                            <input 
                                type="number" 
                                value={sessionTimeoutMinutes} 
                                onChange={(e) => setSessionTimeoutMinutes(Number(e.target.value))}
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-lg font-bold text-center dark:bg-gray-700 dark:text-white" 
                            />
                            <p className="text-[10px] text-gray-400 mt-1">Tempo de inatividade para logout automático.</p>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setIsSettingsOpen(false)} className="flex-1 py-2 text-gray-500 font-bold bg-gray-100 dark:bg-gray-700 rounded-lg">Cancelar</button>
                        <button onClick={handleSaveSettings} className="flex-1 py-2 text-white font-bold bg-wine rounded-lg flex justify-center items-center gap-2"><Save size={16}/> Salvar</button>
                    </div>
                </div>
            </div>
        )}

        {/* Custom Alert Modal */}
        {alertMessage && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in print:hidden">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full border-l-4 border-red-500">
                    <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
                        <AlertCircle size={32} />
                        <h3 className="text-xl font-bold">Atenção</h3>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap mb-6 text-sm">{alertMessage}</p>
                    <button 
                        onClick={() => setAlertMessage(null)}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg transition-colors"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        )}

    </div>
  );
};

export default App;