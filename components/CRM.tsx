
import React, { useMemo, useState, useEffect } from 'react';
import { Order, Customer, PaymentMethod, Employee, ActiveShift, Product } from '../types';
import { Download, Users, Calendar, DollarSign, ArrowLeft, Search, TrendingUp, CreditCard, Wallet, AlertCircle, FileSpreadsheet, ChevronLeft, ChevronRight, ArrowRight, Clock, Plus, Trash2, UserCheck, User, Bike, CheckCircle, Store, BarChart, ShoppingBag, Trophy, Banknote, Smartphone, Globe, Utensils, TrendingDown, Percent, UserPlus, MapPin, Pencil, X, Loader2, History, Pizza, Cookie, CupSoda, NotebookPen, Printer, Timer, Ban, PieChart, ChevronDown, ChevronUp, ShoppingCart, Info, RotateCcw } from 'lucide-react';
import { addEmployee, deleteEmployee } from '../services/staffService';
import { addCustomer, deleteCustomer, getCustomers, updateCustomer } from '../services/customerService';

export type CRMTab = 'DASHBOARD' | 'FINANCE' | 'ORDERS' | 'CLOSURE' | 'STAFF' | 'CUSTOMERS';

interface CRMProps {
  orders: Order[];
  employees: Employee[];
  activeShift: ActiveShift[];
  onUpdateActiveShift: (shift: ActiveShift[]) => void;
  onBack: () => void;
  initialTab?: CRMTab;
  onRepeatOrder?: (order: Order) => void;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

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

export const CRM: React.FC<CRMProps> = ({ orders, employees, activeShift, onUpdateActiveShift, onBack, initialTab, onRepeatOrder }) => {
  const [activeTab, setActiveTab] = useState<CRMTab>(initialTab || 'DASHBOARD');
  const [orderSearch, setOrderSearch] = useState('');
  
  // --- Selected Order State (For Detail Modal) ---
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // --- Loading State for Actions ---
  const [isBusy, setIsBusy] = useState(false);

  // --- Modal State (Refactored to be purely visual) ---
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string } | null>(null);
  
  // --- Pending Action State (Stores logic ID) ---
  const [pendingAction, setPendingAction] = useState<{ type: 'DELETE_CUSTOMER' | 'DELETE_EMPLOYEE'; id: string } | null>(null);

  const [alertModal, setAlertModal] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- New Employee Form State ---
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpRole, setNewEmpRole] = useState('');
  const [newEmpPay, setNewEmpPay] = useState<string>('');
  const [newEmpIsDriver, setNewEmpIsDriver] = useState(false);

  // --- Customer State ---
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustNeighborhood, setNewCustNeighborhood] = useState('');

  // --- Finance Tab States ---
  const [financeStartDate, setFinanceStartDate] = useState(() => {
      const d = new Date();
      d.setDate(1); // First day of current month
      return d.toISOString().split('T')[0];
  });
  const [financeEndDate, setFinanceEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expandedDebtor, setExpandedDebtor] = useState<string | null>(null);

  useEffect(() => {
      if (activeTab === 'CUSTOMERS') {
          loadCustomers();
      }
  }, [activeTab]);

  const loadCustomers = async () => {
      const list = await getCustomers();
      setCustomerList(list);
  };

  const handleEditCustomer = (e: React.MouseEvent, customer: Customer) => {
      e.stopPropagation();
      setEditingCustomer(customer);
      setNewCustName(customer.name);
      setNewCustPhone(customer.phone);
      setNewCustAddress(customer.address);
      setNewCustNeighborhood(customer.neighborhood || '');
  };

  const handleCancelEditCustomer = () => {
      setEditingCustomer(null);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustAddress('');
      setNewCustNeighborhood('');
  };

  const handleSaveCustomer = async () => {
      if (!newCustName || !newCustPhone || !newCustAddress) {
          setAlertModal("Nome, Telefone e Endereço são obrigatórios.");
          return;
      }

      // --- Validação de Duplicidade ---
      const duplicateByPhone = customerList.find(c => 
          c.phone === newCustPhone && c.id !== editingCustomer?.id
      );

      if (duplicateByPhone) {
          setAlertModal(`Já existe um cliente com o telefone ${newCustPhone}:\n${duplicateByPhone.name}`);
          return;
      }

      const duplicateByName = customerList.find(c => 
          c.name.trim().toLowerCase() === newCustName.trim().toLowerCase() && c.id !== editingCustomer?.id
      );

      if (duplicateByName) {
          setAlertModal(`Já existe um cliente com o nome "${newCustName}":\nTel: ${duplicateByName.phone}`);
          return;
      }
      
      setIsBusy(true); 
      try {
          if (editingCustomer && editingCustomer.id) {
              // Update Mode
              await updateCustomer(editingCustomer.id, {
                  name: newCustName,
                  phone: newCustPhone,
                  address: newCustAddress,
                  neighborhood: newCustNeighborhood
              });
              setEditingCustomer(null);
              setSuccessMessage("Dados do cliente atualizados com sucesso!");
          } else {
              // Create Mode
              await addCustomer({
                  name: newCustName,
                  phone: newCustPhone,
                  address: newCustAddress,
                  neighborhood: newCustNeighborhood
              });
              setSuccessMessage("Cliente criado com sucesso!");
          }

          // Reset Form
          setNewCustName('');
          setNewCustPhone('');
          setNewCustAddress('');
          setNewCustNeighborhood('');
          
          // Refresh list
          await loadCustomers();

      } catch (error) {
          console.error(error);
          setAlertModal("Erro ao salvar cliente. Tente novamente.");
      } finally {
          setIsBusy(false); // GUARANTEED to stop loading
      }
  };

  // --- Delete Setup ---
  const handleDeleteCustomer = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setPendingAction({ type: 'DELETE_CUSTOMER', id });
      setConfirmModal({
          isOpen: true,
          title: "Excluir Cliente",
          message: "Tem certeza que deseja excluir este cliente permanentemente? O histórico de pedidos será mantido, mas os dados cadastrais serão removidos."
      });
  };

  const handleDeleteEmployee = (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      setPendingAction({ type: 'DELETE_EMPLOYEE', id });
      setConfirmModal({
          isOpen: true,
          title: "Remover Colaborador",
          message: "Tem certeza que deseja remover este colaborador permanentemente?"
      });
  };

  // --- Execute Confirmed Action ---
  const executePendingAction = async () => {
      if (!pendingAction) return;

      setIsBusy(true); // Lock UI
      try {
          if (pendingAction.type === 'DELETE_CUSTOMER') {
              await deleteCustomer(pendingAction.id);
              await loadCustomers();
              setSuccessMessage("Cliente removido com sucesso.");
          } 
          else if (pendingAction.type === 'DELETE_EMPLOYEE') {
              onUpdateActiveShift(activeShift.filter(s => s.employeeId !== pendingAction.id));
              await deleteEmployee(pendingAction.id);
              setSuccessMessage("Colaborador removido.");
          }
          
          // Close Modal only on success
          setConfirmModal(null);
          setPendingAction(null);

      } catch (error) {
          console.error("Action Error:", error);
          setAlertModal("Ocorreu um erro ao processar a solicitação.");
      } finally {
          setIsBusy(false); // Unlock UI
      }
  };

  const closeConfirmModal = () => {
      if (!isBusy) {
          setConfirmModal(null);
          setPendingAction(null);
      }
  };

  const filteredCustomers = useMemo(() => {
      if (!customerSearch) return customerList;
      const lower = customerSearch.toLowerCase();
      return customerList.filter(c => 
          c.name.toLowerCase().includes(lower) || 
          c.phone.includes(lower)
      );
  }, [customerList, customerSearch]);

  // --- Helper to get last orders for customer ---
  const getLastOrdersForCustomer = (customer: Customer) => {
      // Filter by ID if available, or fallback to phone
      let customerOrders = orders.filter(o => 
          (customer.id && o.customer.id === customer.id) || 
          (o.customer.phone === customer.phone)
      );
      
      // Sort by date desc
      customerOrders.sort((a, b) => b.timestamp - a.timestamp);
      
      return customerOrders.slice(0, 10);
  };

  // --- State for Closure Date Filter (Daily) ---
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); // Adjust to local
    return d.toISOString().split('T')[0];
  });

  // --- State for Custom Comparison Interval (Dashboard) ---
  const [customStartA, setCustomStartA] = useState(() => new Date().toISOString().split('T')[0]);
  const [customEndA, setCustomEndA] = useState(() => new Date().toISOString().split('T')[0]);
  const [customStartB, setCustomStartB] = useState(() => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d.toISOString().split('T')[0];
  });
  const [customEndB, setCustomEndB] = useState(() => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d.toISOString().split('T')[0];
  });

  // --- Helpers ---
  const isSameDay = (d1: Date, d2: Date) => d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
  const getStartOfWeek = (d: Date) => { const date = new Date(d); date.setDate(d.getDate() - d.getDay()); date.setHours(0,0,0,0); return date; };
  const getStartOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  const diffInDays = (d1: Date, d2: Date) => {
      const oneDay = 24 * 60 * 60 * 1000;
      return Math.round(Math.abs((d1.getTime() - d2.getTime()) / oneDay)) + 1; // +1 to include start date
  };

  // --- Date Navigation Helpers (Daily Closure) ---
  const handleDateChange = (offset: number) => {
      const [y, m, d] = selectedDate.split('-').map(n => Number(n));
      const date = new Date(y, m - 1, d);
      date.setDate(date.getDate() + offset);
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      setSelectedDate(`${year}-${month}-${day}`);
  };

  const handleSetToday = () => {
      const d = new Date();
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      setSelectedDate(d.toISOString().split('T')[0]);
  };

  // --- Staff Management Logic ---
  const handleAddEmployee = async () => {
      // Basic validation
      if (!newEmpName.trim() || !newEmpRole.trim()) {
          setAlertModal("Preencha nome e cargo.");
          return;
      }
      
      // If NOT a driver, pay is required
      if (!newEmpIsDriver && !newEmpPay) {
          setAlertModal("Informe o valor por período.");
          return;
      }
      
      setIsBusy(true);
      try {
        await addEmployee({
            name: newEmpName,
            role: newEmpRole,
            payPerPeriod: newEmpIsDriver ? 0 : parseFloat(newEmpPay), // 0 if driver
            isDriver: newEmpIsDriver
        });

        // Reset form
        setNewEmpName('');
        setNewEmpRole('');
        setNewEmpPay('');
        setNewEmpIsDriver(false);
        setSuccessMessage("Colaborador adicionado com sucesso!");
      } catch (e) {
          console.error(e);
          setAlertModal("Erro ao adicionar colaborador.");
      } finally {
          setIsBusy(false);
      }
  };

  const toggleShift = (empId: string) => {
      const exists = activeShift.find(s => s.employeeId === empId);
      if (exists) {
          onUpdateActiveShift(activeShift.filter(s => s.employeeId !== empId));
      } else {
          onUpdateActiveShift([...activeShift, { employeeId: empId, periods: 2 }]); // Default to 2 periods (full day)
      }
  };

  const updatePeriods = (empId: string, periods: 1 | 2) => {
      onUpdateActiveShift(activeShift.map(s => s.employeeId === empId ? { ...s, periods } : s));
  };

  // --- CSV Export Logic ---
  const handleExportCSV = () => {
    const headers = [
        "ID", "Data", "Hora", "Tipo", "Cliente", "Telefone", "Endereço", "Pagamento", "Total Produtos", "Taxa Entrega", "Entregador", "Operador", "Total Geral", "Status", "Motivo Canc."
    ];

    const rows = orders.map(o => {
        const dateObj = new Date(o.timestamp);
        return [
            o.id,
            dateObj.toLocaleDateString('pt-BR'),
            dateObj.toLocaleTimeString('pt-BR'),
            o.type === 'PICKUP' ? 'Retirada' : 'Entrega',
            `"${o.customer.name.replace(/"/g, '""')}"`,
            `"${o.customer.phone}"`,
            `"${o.customer.address.replace(/"/g, '""')}"`,
            o.paymentMethod,
            (o.total - o.deliveryFee).toFixed(2).replace('.', ','),
            o.deliveryFee.toFixed(2).replace('.', ','),
            o.driverName || '-',
            o.operatorName || '-',
            o.total.toFixed(2).replace('.', ','),
            o.status,
            o.cancelReason || '-'
        ].join(';');
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(";") + "\n" + rows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pizza_divina_vendas.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- 1. Dashboard Logic (Standard Comparatives) ---
  const comparatives = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    
    // Normalize to compare only Dates
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const startOfThisWeek = getStartOfWeek(today);
    const startOfLastWeek = new Date(startOfThisWeek); startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);
    const endOfLastWeek = new Date(startOfThisWeek); endOfLastWeek.setDate(startOfThisWeek.getDate() - 1);

    let todayTotal = 0, yesterdayTotal = 0, weekTotal = 0, lastWeekTotal = 0, monthTotal = 0, lastMonthTotal = 0;
    
    // Fiado Logic (Debt)
    let todayFiado = 0, weekFiado = 0, monthFiado = 0;

    let todayCount = 0, weekCount = 0, monthCount = 0;

    const startOfThisMonth = getStartOfMonth(today);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    orders.forEach(o => {
        if (o.status === 'CANCELED') return;
        const d = new Date(o.timestamp);
        const dStr = d.toISOString().split('T')[0];

        // Day
        if (dStr === todayStr) { 
            todayTotal += o.total; 
            todayCount++; 
            if (o.paymentMethod === 'FIADO') todayFiado += o.total;
        }
        if (dStr === yesterdayStr) yesterdayTotal += o.total;

        // Week
        if (d >= startOfThisWeek) { 
            weekTotal += o.total; 
            weekCount++; 
            if (o.paymentMethod === 'FIADO') weekFiado += o.total;
        }
        else if (d >= startOfLastWeek && d <= endOfLastWeek) lastWeekTotal += o.total;

        // Month
        if (d >= startOfThisMonth) { 
            monthTotal += o.total; 
            monthCount++; 
            if (o.paymentMethod === 'FIADO') monthFiado += o.total;
        }
        else if (d >= startOfLastMonth && d <= endOfLastMonth) lastMonthTotal += o.total;
    });

    const avgTicketToday = todayCount > 0 ? todayTotal / todayCount : 0;
    const avgTicketWeek = weekCount > 0 ? weekTotal / weekCount : 0;
    const avgTicketMonth = monthCount > 0 ? monthTotal / monthCount : 0;

    return {
        today: { val: todayTotal, prev: yesterdayTotal, label: 'Hoje vs Ontem' },
        week: { val: weekTotal, prev: lastWeekTotal, label: 'Esta Semana vs Anterior' },
        month: { val: monthTotal, prev: lastMonthTotal, label: 'Este Mês vs Anterior' },
        avgTicket: { today: avgTicketToday, week: avgTicketWeek, month: avgTicketMonth },
        fiado: { today: todayFiado, week: weekFiado, month: monthFiado }
    };
  }, [orders]);

  // --- 2. Custom Interval Logic (Updated with Staff Costs) ---
  const customIntervalData = useMemo(() => {
      let totalSalesA = 0;
      let totalSalesB = 0;
      let driverFeesA = 0;
      let driverFeesB = 0;

      const sA = new Date(customStartA + "T00:00:00");
      const eA = new Date(customEndA + "T23:59:59");
      const sB = new Date(customStartB + "T00:00:00");
      const eB = new Date(customEndB + "T23:59:59");

      // Calculate days in period
      const daysCountA = diffInDays(eA, sA);
      const daysCountB = diffInDays(eB, sB);

      // Current Fixed Staff Cost per Day (Estimate based on current shift)
      let currentDailyFixedStaffCost = 0;
      activeShift.forEach(s => {
          const emp = employees.find(e => e.id === s.employeeId);
          if (emp && !emp.isDriver) {
              currentDailyFixedStaffCost += emp.payPerPeriod * s.periods;
          }
      });

      orders.forEach(o => {
          if (o.status === 'CANCELED') return;
          const d = new Date(o.timestamp);
          
          // Period A
          if (d >= sA && d <= eA) {
              totalSalesA += o.total;
              driverFeesA += o.deliveryFee;
          }
          // Period B
          if (d >= sB && d <= eB) {
              totalSalesB += o.total;
              driverFeesB += o.deliveryFee;
          }
      });

      const fixedTeamCostA = currentDailyFixedStaffCost * daysCountA;
      const fixedTeamCostB = currentDailyFixedStaffCost * daysCountB;

      return { 
          totalSalesA, 
          totalSalesB,
          driverFeesA,
          driverFeesB,
          fixedTeamCostA,
          fixedTeamCostB,
          totalStaffCostA: driverFeesA + fixedTeamCostA,
          totalStaffCostB: driverFeesB + fixedTeamCostB
      };
  }, [orders, customStartA, customEndA, customStartB, customEndB, activeShift, employees]);

  // --- 3. Closure Logic (Fechamento) ---
  const closureData = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(n => Number(n));
    const targetDate = new Date(y, m - 1, d); 

    const filteredOrders = orders.filter(o => isSameDay(new Date(o.timestamp), targetDate) && o.status !== 'CANCELED');

    const totalSales = filteredOrders.reduce((acc, o) => acc + o.total, 0);
    const totalFees = filteredOrders.reduce((acc, o) => acc + o.deliveryFee, 0);
    const totalWithoutFees = totalSales - totalFees;

    const byMethod: Record<PaymentMethod, number> = { 'DINHEIRO': 0, 'CREDITO': 0, 'DEBITO': 0, 'REFEICAO': 0, 'PIX': 0, 'IFOOD': 0, 'FIADO': 0 };

    filteredOrders.forEach(o => {
        if (byMethod[o.paymentMethod] !== undefined) {
            byMethod[o.paymentMethod] += o.total;
        }
    });
    
    // --- Driver Payouts Calculation & Ranking ---
    const driverPayouts: Record<string, number> = {};
    const driverDeliveriesCount: Record<string, number> = {};
    
    filteredOrders.forEach(o => {
        if (o.type === 'DELIVERY' && o.driverName) {
            driverPayouts[o.driverName] = (driverPayouts[o.driverName] || 0) + o.deliveryFee;
            driverDeliveriesCount[o.driverName] = (driverDeliveriesCount[o.driverName] || 0) + 1;
        }
    });

    // --- Delivery vs Pickup Count ---
    const deliveryCount = filteredOrders.filter(o => o.type === 'DELIVERY').length;
    const pickupCount = filteredOrders.filter(o => o.type === 'PICKUP').length;

    // --- Product Ranking Logic (Updated for Categories) ---
    const productStats: Record<string, { count: number, category: string }> = {};
    
    filteredOrders.forEach(order => {
        order.items.forEach(item => {
            if (item.flavors && item.flavors.length > 0) {
                // For multi-flavor pizzas, count each flavor
                item.flavors.forEach(f => {
                    const current = productStats[f.sabor] || { count: 0, category: f.categoria };
                    productStats[f.sabor] = { count: current.count + item.quantity, category: f.categoria };
                });
            } else {
                const current = productStats[item.product.sabor] || { count: 0, category: item.product.categoria };
                productStats[item.product.sabor] = { count: current.count + item.quantity, category: item.product.categoria };
            }
        });
    });

    const topProducts = Object.entries(productStats)
        .map(([name, data]) => ({ name, count: data.count, category: data.category }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8); // Showing top 8

    // --- Fixed Staff Cost Calculation ---
    let staffCost = 0;
    activeShift.forEach(s => {
        const emp = employees.find(e => e.id === s.employeeId);
        if (emp && !emp.isDriver) {
            staffCost += emp.payPerPeriod * s.periods;
        }
    });

    // --- Fiado Logic ---
    const totalFiado = byMethod['FIADO'] || 0;
    const fiadoDebtors = filteredOrders
        .filter(o => o.paymentMethod === 'FIADO')
        .map(o => ({
            name: o.customer.name,
            phone: o.customer.phone,
            total: o.total,
            id: o.id
        }));

    // Net Result Calculation: (Total - Fees - Staff - Fiado)
    // Money actually in hand.
    const netTotal = totalSales - totalFees - staffCost - totalFiado;

    // Ticket Average
    const ticketAvg = filteredOrders.length > 0 ? totalSales / filteredOrders.length : 0;

    return { 
        totalSales, 
        totalFees, 
        totalWithoutFees, 
        byMethod, 
        count: filteredOrders.length, 
        targetDate, 
        driverPayouts, 
        driverDeliveriesCount,
        staffCost, 
        totalFiado,
        fiadoDebtors,
        netTotal, 
        topProducts, 
        deliveryCount, 
        pickupCount, 
        ticketAvg
    };
  }, [orders, selectedDate, activeShift, employees]);

  // --- 4. FINANCE Tab Logic ---
  const financeData = useMemo(() => {
      const start = new Date(financeStartDate + "T00:00:00");
      const end = new Date(financeEndDate + "T23:59:59");

      const filteredOrders = orders.filter(o => {
          if (o.status === 'CANCELED') return false;
          const d = new Date(o.timestamp);
          return d >= start && d <= end;
      });

      // Aggregations
      let totalSales = 0;
      let totalFees = 0;
      let totalDiscount = 0;
      const byMethod: Record<string, number> = {};
      
      // Drivers
      const drivers: Record<string, { count: number, fees: number }> = {};

      // Debtors (Fiado)
      const debtors: Record<string, { name: string, phone: string, total: number, orders: Order[] }> = {};

      filteredOrders.forEach(o => {
          totalSales += o.total;
          totalFees += o.deliveryFee;
          if (o.discount) totalDiscount += o.discount;

          // By Method
          byMethod[o.paymentMethod] = (byMethod[o.paymentMethod] || 0) + o.total;

          // Drivers
          if (o.driverName && o.type === 'DELIVERY') {
              if (!drivers[o.driverName]) drivers[o.driverName] = { count: 0, fees: 0 };
              drivers[o.driverName].count++;
              drivers[o.driverName].fees += o.deliveryFee;
          }

          // Debtors (Logic: Aggregating 'FIADO' orders)
          if (o.paymentMethod === 'FIADO') {
              // Group by Phone first, then Name as fallback
              const key = o.customer.phone || o.customer.name;
              if (!debtors[key]) {
                  debtors[key] = {
                      name: o.customer.name,
                      phone: o.customer.phone,
                      total: 0,
                      orders: []
                  };
              }
              debtors[key].total += o.total;
              debtors[key].orders.push(o);
          }
      });

      // Sort Debtors by total desc
      const sortedDebtors = Object.values(debtors).sort((a, b) => b.total - a.total);
      
      // Sort Drivers by fees desc
      const sortedDrivers = Object.entries(drivers).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.fees - a.fees);

      return {
          totalSales,
          totalFees,
          totalDiscount,
          netSales: totalSales - totalFees,
          byMethod,
          drivers: sortedDrivers,
          debtors: sortedDebtors,
          totalFiado: byMethod['FIADO'] || 0
      };
  }, [orders, financeStartDate, financeEndDate]);

  // --- 5. Filtered Orders (Expanded Search) ---
  const filteredOrders = useMemo(() => {
    if (!orderSearch) return [...orders].reverse(); 
    const lower = orderSearch.toLowerCase();
    
    return orders.filter(o => 
        // 1. ID
        o.id.toString().includes(lower) || 
        // 2. Customer
        o.customer.name.toLowerCase().includes(lower) || 
        o.customer.phone.includes(lower) ||
        // 3. Driver
        o.driverName?.toLowerCase().includes(lower) ||
        // 4. Date
        o.date.toLowerCase().includes(lower) ||
        // 5. Type
        (o.type === 'PICKUP' ? 'retirada' : 'entrega').includes(lower) ||
        // 6. Total Value (Formatted)
        o.total.toFixed(2).replace('.', ',').includes(lower) ||
        // 7. Status
        o.status.toLowerCase().includes(lower)
    ).reverse();
  }, [orders, orderSearch]);

  const ComparisonBar = ({ current, previous, label, inverse = false }: { current: number; previous: number; label: string, inverse?: boolean }) => { 
      const max = Math.max(current, previous, 1);
      const diff = current - previous;
      const isPositiveGood = inverse ? diff <= 0 : diff >= 0;
      
      return (
          <div className="mb-4 bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
             <div className="flex justify-between mb-2 items-center">
                 <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{label}</span>
                 <div className="text-right">
                     <div className="text-xs font-bold text-gray-500 dark:text-gray-400">Diferença</div>
                     <span className={`text-xs font-bold px-2 py-0.5 rounded ${isPositiveGood ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                         {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                     </span>
                 </div>
             </div>
             
             {/* Bars */}
             <div className="space-y-2">
                 <div>
                     <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                         <span>Atual (A)</span>
                         <span>{formatCurrency(current)}</span>
                     </div>
                     <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                         <div style={{width: `${(current/max)*100}%`}} className={`h-full rounded-full ${inverse ? 'bg-red-500' : 'bg-blue-600'}`}></div>
                     </div>
                 </div>
                 <div>
                     <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                         <span>Anterior (B)</span>
                         <span>{formatCurrency(previous)}</span>
                     </div>
                     <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                         <div style={{width: `${(previous/max)*100}%`}} className="h-full bg-gray-400 rounded-full"></div>
                     </div>
                 </div>
             </div>
          </div>
      )
  };

  // Helper to determine icon for product category
  const getProductIcon = (cat: string) => {
      const lower = cat.toLowerCase();
      if (lower.includes('pizza')) return <Pizza size={14} />;
      if (lower.includes('pastel')) return <Cookie size={14} />; // Using Cookie as it looks closer to a round pastel/dough
      if (lower.includes('bebida')) return <CupSoda size={14} />;
      return <Utensils size={14} />;
  };

  const getCategoryColor = (cat: string) => {
      const lower = cat.toLowerCase();
      if (lower.includes('pizza')) return 'bg-orange/10 text-orange border-orange/20';
      if (lower.includes('pastel')) return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
      if (lower.includes('bebida')) return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const formatItemName = (product: Product, flavors?: Product[]) => {
      if (flavors && flavors.length > 1) {
          return `Pizza ${flavors.length} Sabores`;
      }
      if (product.categoria.toLowerCase().includes('pastel')) {
          return `Pastel - ${product.sabor}`;
      }
      return product.sabor;
  };

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
      return method === 'PIX' || method === 'IFOOD' || method === 'FIADO';
  };

  const getPaymentStyle = (method: PaymentMethod) => {
      if (method === 'FIADO') return 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800';
      if (isOnlinePayment(method)) return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
      return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900 h-full flex flex-col font-sans transition-colors duration-200">
        {/* Header Fixed */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex flex-col md:flex-row justify-between items-center shrink-0 gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-wine dark:text-gray-200"><ArrowLeft /></button>
                <h1 className="text-2xl font-serif text-wine dark:text-gold font-bold">Gestão & CRM</h1>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto overflow-x-auto items-center pb-2 md:pb-0">
                <button onClick={() => setActiveTab('DASHBOARD')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab === 'DASHBOARD' ? 'bg-wine text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200'}`}><TrendingUp size={16} /> Visão</button>
                <button onClick={() => setActiveTab('FINANCE')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab === 'FINANCE' ? 'bg-wine text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200'}`}><PieChart size={16} /> Financeiro</button>
                <button onClick={() => setActiveTab('CUSTOMERS')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab === 'CUSTOMERS' ? 'bg-wine text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200'}`}><User size={16} /> Clientes</button>
                <button onClick={() => setActiveTab('STAFF')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab === 'STAFF' ? 'bg-wine text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200'}`}><Users size={16} /> Colaboradores</button>
                <button onClick={() => setActiveTab('CLOSURE')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab === 'CLOSURE' ? 'bg-wine text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200'}`}><DollarSign size={16} /> Fechamento</button>
                <button onClick={() => setActiveTab('ORDERS')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab === 'ORDERS' ? 'bg-wine text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200'}`}><Search size={16} /> Pedidos</button>
                <button onClick={handleExportCSV} className="px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 bg-green-600 text-white whitespace-nowrap"><FileSpreadsheet size={16} /></button>
            </div>
        </div>

        {/* Content Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                
                {/* --- TAB: DASHBOARD --- */}
                {activeTab === 'DASHBOARD' && (
                    <div className="animate-fade-in space-y-8">
                         {/* Ticket Average Stats */}
                         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                             <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                 <p className="text-xs text-gray-500 uppercase font-bold">Ticket Médio (Hoje)</p>
                                 <h3 className="text-xl font-bold text-wine dark:text-gold">{formatCurrency(comparatives.avgTicket.today)}</h3>
                             </div>
                             <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                 <p className="text-xs text-gray-500 uppercase font-bold">Ticket Médio (Semana)</p>
                                 <h3 className="text-xl font-bold text-wine dark:text-gold">{formatCurrency(comparatives.avgTicket.week)}</h3>
                             </div>
                             <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                 <p className="text-xs text-gray-500 uppercase font-bold">Ticket Médio (Mês)</p>
                                 <h3 className="text-xl font-bold text-wine dark:text-gold">{formatCurrency(comparatives.avgTicket.month)}</h3>
                             </div>
                         </div>

                         {/* Sales Comparison */}
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border-l-4 border-leaf flex flex-col justify-between">
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase mb-1">Vendas Hoje</p>
                                    <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{formatCurrency(comparatives.today.val)}</h3>
                                    {comparatives.fiado.today > 0 && (
                                        <div className="mt-2 text-xs text-red-500 font-bold bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded inline-block">
                                            - {formatCurrency(comparatives.fiado.today)} (Fiado a Receber)
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                    <ComparisonBar current={comparatives.today.val} previous={comparatives.today.prev} label="Comparado a Ontem" />
                                </div>
                            </div>
                            
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border-l-4 border-gold flex flex-col justify-between">
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase mb-1">Vendas da Semana</p>
                                    <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{formatCurrency(comparatives.week.val)}</h3>
                                    {comparatives.fiado.week > 0 && (
                                        <div className="mt-2 text-xs text-red-500 font-bold bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded inline-block">
                                            - {formatCurrency(comparatives.fiado.week)} (Fiado a Receber)
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                    <ComparisonBar current={comparatives.week.val} previous={comparatives.week.prev} label="Comparado à Semana Anterior" />
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border-l-4 border-orange flex flex-col justify-between">
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase mb-1">Vendas do Mês</p>
                                    <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{formatCurrency(comparatives.month.val)}</h3>
                                    {comparatives.fiado.month > 0 && (
                                        <div className="mt-2 text-xs text-red-500 font-bold bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded inline-block">
                                            - {formatCurrency(comparatives.fiado.month)} (Fiado a Receber)
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                    <ComparisonBar current={comparatives.month.val} previous={comparatives.month.prev} label="Comparado ao Mês Anterior" />
                                </div>
                            </div>
                         </div>

                         {/* FIADO Specific Card */}
                         {comparatives.fiado.today > 0 && (
                             <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-4 rounded-xl flex items-center justify-between">
                                 <div className="flex items-center gap-3">
                                     <div className="p-3 bg-rose-100 dark:bg-rose-900/50 rounded-full text-rose-600 dark:text-rose-300">
                                         <NotebookPen size={24} />
                                     </div>
                                     <div>
                                         <h4 className="text-rose-800 dark:text-rose-200 font-bold text-lg">Total em Fiado (Hoje)</h4>
                                         <p className="text-xs text-rose-600 dark:text-rose-400">Valor pendente de recebimento contabilizado negativamente no caixa líquido.</p>
                                     </div>
                                 </div>
                                 <div className="text-right">
                                     <span className="text-2xl font-bold text-rose-700 dark:text-rose-300">{formatCurrency(comparatives.fiado.today)}</span>
                                 </div>
                             </div>
                         )}

                         {/* Custom Interval Comparison */}
                         <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                             <h3 className="text-lg font-bold text-wine dark:text-gray-200 mb-6 flex items-center gap-2">
                                 <BarChart className="text-orange" /> Comparativo e Análise de Período
                             </h3>
                             
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                                 {/* Period A */}
                                 <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-blue-200 dark:border-blue-900/50">
                                     <h4 className="text-blue-600 dark:text-blue-400 font-bold mb-3 uppercase text-sm">Período A (Azul)</h4>
                                     <div className="flex gap-2 mb-4">
                                         <input type="date" value={customStartA} onChange={e => setCustomStartA(e.target.value)} className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 text-sm" />
                                         <span className="self-center dark:text-gray-400">até</span>
                                         <input type="date" value={customEndA} onChange={e => setCustomEndA(e.target.value)} className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 text-sm" />
                                     </div>
                                     <div className="text-right border-b border-gray-200 dark:border-gray-700 pb-2 mb-2">
                                         <p className="text-xs text-gray-500 uppercase">Faturamento</p>
                                         <span className="text-2xl font-bold text-gray-800 dark:text-white">{formatCurrency(customIntervalData.totalSalesA)}</span>
                                     </div>
                                     <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                         <div className="flex justify-between">
                                             <span>Entregadores (Taxas):</span>
                                             <span className="text-red-600 font-bold">{formatCurrency(customIntervalData.driverFeesA)}</span>
                                         </div>
                                         <div className="flex justify-between">
                                             <span>Equipe Fixa (Est.*):</span>
                                             <span className="text-red-600 font-bold">{formatCurrency(customIntervalData.fixedTeamCostA)}</span>
                                         </div>
                                         <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-1 mt-1">
                                             <span className="font-bold">Total Pessoal:</span>
                                             <span className="text-red-600 font-bold">{formatCurrency(customIntervalData.totalStaffCostA)}</span>
                                         </div>
                                     </div>
                                 </div>

                                 {/* Period B */}
                                 <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-300 dark:border-gray-600">
                                     <h4 className="text-gray-600 dark:text-gray-400 font-bold mb-3 uppercase text-sm">Período B (Cinza)</h4>
                                     <div className="flex gap-2 mb-4">
                                         <input type="date" value={customStartB} onChange={e => setCustomStartB(e.target.value)} className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 text-sm" />
                                         <span className="self-center dark:text-gray-400">até</span>
                                         <input type="date" value={customEndB} onChange={e => setCustomEndB(e.target.value)} className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 text-sm" />
                                     </div>
                                     <div className="text-right border-b border-gray-200 dark:border-gray-700 pb-2 mb-2">
                                         <p className="text-xs text-gray-500 uppercase">Faturamento</p>
                                         <span className="text-2xl font-bold text-gray-600 dark:text-gray-300">{formatCurrency(customIntervalData.totalSalesB)}</span>
                                     </div>
                                     <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                         <div className="flex justify-between">
                                             <span>Entregadores (Taxas):</span>
                                             <span className="text-red-500 font-bold">{formatCurrency(customIntervalData.driverFeesB)}</span>
                                         </div>
                                         <div className="flex justify-between">
                                             <span>Equipe Fixa (Est.*):</span>
                                             <span className="text-red-500 font-bold">{formatCurrency(customIntervalData.fixedTeamCostB)}</span>
                                         </div>
                                         <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-1 mt-1">
                                             <span className="font-bold">Total Pessoal:</span>
                                             <span className="text-red-500 font-bold">{formatCurrency(customIntervalData.totalStaffCostB)}</span>
                                         </div>
                                     </div>
                                 </div>
                             </div>
                             
                             <p className="text-[10px] text-gray-400 italic mb-6">* Custo de Equipe Fixa estimado com base na escala de trabalho ATUAL multiplicada pelos dias do período.</p>

                             {/* Visual Bars */}
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 <ComparisonBar current={customIntervalData.totalSalesA} previous={customIntervalData.totalSalesB} label="Comparativo de Faturamento (A vs B)" />
                                 <ComparisonBar current={customIntervalData.totalStaffCostA} previous={customIntervalData.totalStaffCostB} label="Comparativo de Custo Pessoal (A vs B)" inverse={true} />
                             </div>
                         </div>
                    </div>
                )}

                {/* --- TAB: FINANCE (NEW) --- */}
                {activeTab === 'FINANCE' && (
                    <div className="animate-fade-in space-y-8">
                        {/* Filters */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                            <h2 className="text-xl font-bold text-wine dark:text-gold mb-4 flex items-center gap-2"><PieChart /> Controle Financeiro & Relatórios</h2>
                            <div className="flex gap-4 items-center flex-wrap">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Início</label>
                                    <input type="date" value={financeStartDate} onChange={e => setFinanceStartDate(e.target.value)} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fim</label>
                                    <input type="date" value={financeEndDate} onChange={e => setFinanceEndDate(e.target.value)} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
                                </div>
                            </div>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-l-4 border-green-500">
                                <p className="text-xs text-gray-500 uppercase font-bold">Vendas Totais (Bruto)</p>
                                <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{formatCurrency(financeData.totalSales)}</h3>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-l-4 border-red-500">
                                <p className="text-xs text-gray-500 uppercase font-bold">Taxas de Entrega</p>
                                <h3 className="text-2xl font-bold text-red-600">{formatCurrency(financeData.totalFees)}</h3>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-l-4 border-blue-500">
                                <p className="text-xs text-gray-500 uppercase font-bold">Vendas Líquidas</p>
                                <h3 className="text-2xl font-bold text-blue-600">{formatCurrency(financeData.netSales)}</h3>
                                <p className="text-[10px] text-gray-400">Descontando taxas</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-l-4 border-orange">
                                <p className="text-xs text-gray-500 uppercase font-bold">Total em Fiado</p>
                                <h3 className="text-2xl font-bold text-orange">{formatCurrency(financeData.byMethod['FIADO'] || 0)}</h3>
                                <p className="text-[10px] text-gray-400">Pendente de recebimento</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Breakdown by Payment Method */}
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                <h3 className="font-bold text-lg mb-4 text-gray-700 dark:text-gray-200 flex items-center gap-2"><Wallet size={20}/> Vendas por Pagamento</h3>
                                <div className="space-y-3">
                                    {Object.entries(financeData.byMethod).map(([method, val]) => (
                                        <div key={method} className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-2">
                                            <span className="text-sm font-bold text-gray-600 dark:text-gray-300">{method}</span>
                                            <span className="font-mono font-bold text-gray-800 dark:text-gray-100">{formatCurrency(val as number)}</span>
                                        </div>
                                    ))}
                                    {Object.keys(financeData.byMethod).length === 0 && <p className="text-gray-400 text-sm">Sem dados para o período.</p>}
                                </div>
                            </div>

                            {/* Drivers Report */}
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                <h3 className="font-bold text-lg mb-4 text-gray-700 dark:text-gray-200 flex items-center gap-2"><Bike size={20}/> Entregadores (Taxas)</h3>
                                <div className="space-y-3">
                                    {financeData.drivers.map((d) => (
                                        <div key={d.name} className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-2">
                                            <div>
                                                <span className="text-sm font-bold text-gray-600 dark:text-gray-300 block">{d.name}</span>
                                                <span className="text-xs text-gray-400">{d.count} entregas</span>
                                            </div>
                                            <span className="font-mono font-bold text-gray-800 dark:text-gray-100">{formatCurrency(d.fees)}</span>
                                        </div>
                                    ))}
                                    {financeData.drivers.length === 0 && <p className="text-gray-400 text-sm">Nenhuma entrega no período.</p>}
                                </div>
                            </div>
                        </div>

                        {/* Fiado Debtors List (Finance Tab) */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                            <h3 className="font-bold text-lg mb-4 text-gray-700 dark:text-gray-200 flex items-center gap-2"><NotebookPen size={20}/> Contas em Aberto (Fiado) no Período</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 uppercase text-xs">
                                        <tr>
                                            <th className="p-3">Cliente</th>
                                            <th className="p-3">Telefone</th>
                                            <th className="p-3 text-right">Total Devido</th>
                                            <th className="p-3 text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {financeData.debtors.map((debtor, idx) => (
                                            <React.Fragment key={idx}>
                                                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => setExpandedDebtor(expandedDebtor === debtor.phone ? null : debtor.phone)}>
                                                    <td className="p-3 font-bold text-gray-700 dark:text-gray-200">{debtor.name}</td>
                                                    <td className="p-3 text-gray-600 dark:text-gray-400">{debtor.phone}</td>
                                                    <td className="p-3 text-right font-bold text-red-600 dark:text-red-400">{formatCurrency(debtor.total)}</td>
                                                    <td className="p-3 text-center">
                                                        <button className="text-gray-400 hover:text-wine dark:hover:text-gold">
                                                            {expandedDebtor === debtor.phone ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                                        </button>
                                                    </td>
                                                </tr>
                                                {expandedDebtor === debtor.phone && (
                                                    <tr>
                                                        <td colSpan={4} className="p-3 bg-gray-50 dark:bg-gray-900/50">
                                                            <div className="text-xs space-y-1">
                                                                <p className="font-bold mb-2 text-gray-500">Pedidos deste cliente neste período:</p>
                                                                {debtor.orders.map(o => (
                                                                    <div key={o.id} className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-1 mb-1 last:border-0">
                                                                        <span>#{o.id} - {new Date(o.timestamp).toLocaleDateString()}</span>
                                                                        <span>{formatCurrency(o.total)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                        {financeData.debtors.length === 0 && (
                                            <tr><td colSpan={4} className="p-4 text-center text-gray-400">Nenhum registro de fiado neste período.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TAB: CLOSURE --- */}
                {activeTab === 'CLOSURE' && (
                    <div className="animate-fade-in space-y-6">
                        {/* Date Selector */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-wine dark:text-gold flex items-center gap-2"><DollarSign /> Fechamento de Caixa</h2>
                            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                                <button onClick={() => handleDateChange(-1)} className="p-2 hover:bg-white dark:hover:bg-gray-600 rounded shadow-sm transition-all"><ChevronLeft size={16}/></button>
                                <div className="flex flex-col items-center px-4 min-w-[120px]">
                                    <span className="text-xs font-bold text-gray-400 uppercase">Data</span>
                                    <span className="font-bold text-gray-800 dark:text-white">{new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                                </div>
                                <button onClick={() => handleDateChange(1)} className="p-2 hover:bg-white dark:hover:bg-gray-600 rounded shadow-sm transition-all"><ChevronRight size={16}/></button>
                                <button onClick={handleSetToday} className="ml-2 text-xs font-bold text-blue-600 hover:underline">Hoje</button>
                            </div>
                        </div>

                        {/* Top Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-green-600 text-white p-4 rounded-xl shadow-lg">
                                <p className="text-xs opacity-80 uppercase font-bold">Total Vendido</p>
                                <h3 className="text-3xl font-bold">{formatCurrency(closureData.totalSales)}</h3>
                                <p className="text-xs mt-1">{closureData.count} pedidos realizados</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-l-4 border-red-500">
                                <p className="text-xs text-gray-500 uppercase font-bold">Total Taxas (Motoboys)</p>
                                <h3 className="text-2xl font-bold text-red-600">{formatCurrency(closureData.totalFees)}</h3>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-l-4 border-orange">
                                <p className="text-xs text-gray-500 uppercase font-bold">Custo Operacional (Equipe)</p>
                                <h3 className="text-2xl font-bold text-orange">{formatCurrency(closureData.staffCost)}</h3>
                                <p className="text-[10px] text-gray-400">Baseado na escala do dia</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-l-4 border-blue-600">
                                <p className="text-xs text-gray-500 uppercase font-bold">Resultado Líquido (Caixa)</p>
                                <h3 className="text-2xl font-bold text-blue-600">{formatCurrency(closureData.netTotal)}</h3>
                                <p className="text-[10px] text-gray-400">Vendas - Taxas - Equipe - Fiado</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Breakdown by Method */}
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                <h3 className="font-bold text-lg mb-4 text-gray-700 dark:text-gray-200 flex items-center gap-2"><Wallet size={20}/> Detalhamento por Pagamento</h3>
                                <div className="space-y-3">
                                    {Object.entries(closureData.byMethod).map(([method, val]) => (
                                        <div key={method} className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-2">
                                            <span className="text-sm font-bold text-gray-600 dark:text-gray-300">{getPaymentLabel(method as PaymentMethod)}</span>
                                            <span className="font-mono font-bold text-gray-800 dark:text-gray-100">{formatCurrency(val as number)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                             {/* Driver Payouts */}
                             <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                <h3 className="font-bold text-lg mb-4 text-gray-700 dark:text-gray-200 flex items-center gap-2"><Bike size={20}/> Pagamento de Entregadores</h3>
                                <div className="space-y-3">
                                    {Object.entries(closureData.driverPayouts).map(([name, val]) => (
                                        <div key={name} className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-2">
                                            <div>
                                                <span className="text-sm font-bold text-gray-600 dark:text-gray-300 block">{name}</span>
                                                <span className="text-xs text-gray-400">{closureData.driverDeliveriesCount[name]} entregas</span>
                                            </div>
                                            <span className="font-mono font-bold text-red-600 dark:text-red-400">{formatCurrency(val as number)}</span>
                                        </div>
                                    ))}
                                    {Object.keys(closureData.driverPayouts).length === 0 && <p className="text-gray-400 text-sm">Nenhuma entrega registrada.</p>}
                                </div>
                            </div>
                        </div>

                        {/* Top Products */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                             <h3 className="font-bold text-lg mb-4 text-gray-700 dark:text-gray-200 flex items-center gap-2"><Trophy size={20}/> Produtos Mais Vendidos</h3>
                             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                 {closureData.topProducts.map((p, i) => (
                                     <div key={i} className={`p-3 rounded-lg border flex items-center justify-between ${getCategoryColor(p.category)} bg-opacity-10 dark:bg-opacity-10`}>
                                         <div className="flex items-center gap-2 overflow-hidden">
                                             <div className="font-bold text-lg text-gray-400 opacity-50">#{i+1}</div>
                                             <div className="truncate">
                                                 <p className="font-bold text-sm truncate">{p.name}</p>
                                                 <p className="text-[10px] opacity-70 flex items-center gap-1">{getProductIcon(p.category)} {p.category}</p>
                                             </div>
                                         </div>
                                         <span className="font-bold text-lg">{p.count}</span>
                                     </div>
                                 ))}
                             </div>
                        </div>
                    </div>
                )}

                {/* --- TAB: ORDERS --- */}
                {activeTab === 'ORDERS' && (
                    <div className="animate-fade-in flex flex-col h-full">
                         {/* Search Bar */}
                         <div className="mb-4">
                             <div className="relative">
                                 <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                                 <input 
                                     type="text" 
                                     placeholder="Buscar por ID, Cliente, Telefone, Motoboy..." 
                                     value={orderSearch}
                                     onChange={(e) => setOrderSearch(e.target.value)}
                                     className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-wine outline-none shadow-sm"
                                 />
                             </div>
                         </div>

                         {/* Orders List */}
                         <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                             <table className="w-full text-left text-sm">
                                 <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 uppercase text-xs sticky top-0 z-10">
                                     <tr>
                                         <th className="p-4">#ID</th>
                                         <th className="p-4">Data/Hora</th>
                                         <th className="p-4">Cliente</th>
                                         <th className="p-4">Tipo</th>
                                         <th className="p-4">Pagamento</th>
                                         <th className="p-4">Total</th>
                                         <th className="p-4">Status</th>
                                         <th className="p-4 text-center">Ações</th>
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                     {filteredOrders.length === 0 ? (
                                         <tr>
                                             <td colSpan={8} className="p-8 text-center text-gray-400">Nenhum pedido encontrado.</td>
                                         </tr>
                                     ) : (
                                         filteredOrders.map(order => (
                                             <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                 <td className="p-4 font-bold text-wine dark:text-gold">#{order.id}</td>
                                                 <td className="p-4 text-gray-600 dark:text-gray-300">
                                                     <div className="font-bold">{new Date(order.timestamp).toLocaleDateString()}</div>
                                                     <div className="text-xs">{new Date(order.timestamp).toLocaleTimeString()}</div>
                                                 </td>
                                                 <td className="p-4">
                                                     <div className="font-bold text-gray-800 dark:text-gray-200">{order.customer.name}</div>
                                                     <div className="text-xs text-gray-500">{order.customer.phone}</div>
                                                 </td>
                                                 <td className="p-4">
                                                     <span className={`px-2 py-1 rounded text-xs font-bold ${order.type === 'DELIVERY' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                                                         {order.type === 'DELIVERY' ? 'Entrega' : 'Retirada'}
                                                     </span>
                                                 </td>
                                                 <td className="p-4 text-gray-600 dark:text-gray-300 flex items-center gap-2">
                                                     {order.paymentMethod === 'FIADO' ? <NotebookPen size={14} className="text-red-500"/> : null}
                                                     {getPaymentLabel(order.paymentMethod)}
                                                 </td>
                                                 <td className="p-4 font-mono font-bold text-gray-800 dark:text-gray-100">{formatCurrency(order.total)}</td>
                                                 <td className="p-4">
                                                     <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                         order.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                                         order.status === 'CANCELED' ? 'bg-red-100 text-red-700' :
                                                         'bg-yellow-100 text-yellow-700'
                                                     }`}>
                                                         {order.status === 'CONFIRMED' ? 'Novo' : 
                                                          order.status === 'KITCHEN' ? 'Cozinha' : 
                                                          order.status === 'DELIVERY' ? 'Entrega' : 
                                                          order.status === 'COMPLETED' ? 'Concluído' : 'Cancelado'}
                                                     </span>
                                                 </td>
                                                 <td className="p-4 text-center flex justify-center gap-2">
                                                     <button onClick={() => setSelectedOrder(order)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-gray-500" title="Ver Detalhes">
                                                         <Info size={18} />
                                                     </button>
                                                     <button 
                                                         onClick={() => onRepeatOrder && onRepeatOrder(order)}
                                                         className="p-2 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-lg text-green-600 dark:text-green-400" 
                                                         title="Repetir Pedido"
                                                     >
                                                         <RotateCcw size={18} />
                                                     </button>
                                                 </td>
                                             </tr>
                                         ))
                                     )}
                                 </tbody>
                             </table>
                         </div>
                    </div>
                )}

                {/* --- TAB: STAFF --- */}
                {activeTab === 'STAFF' && (
                    <div className="animate-fade-in">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            
                            {/* Shift Management */}
                            <div className="lg:col-span-2 space-y-6">
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                    <h3 className="font-bold text-lg mb-6 text-gray-700 dark:text-gray-200 flex items-center gap-2"><Clock /> Escala de Hoje</h3>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {employees.map(emp => {
                                            const shift = activeShift.find(s => s.employeeId === emp.id);
                                            const isSelected = !!shift;
                                            
                                            return (
                                                <div 
                                                    key={emp.id}
                                                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${isSelected ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 bg-white dark:bg-gray-800'}`}
                                                    onClick={() => toggleShift(emp.id)}
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${emp.isDriver ? 'bg-orange/10 text-orange' : 'bg-blue-100 text-blue-600'}`}>
                                                                {emp.isDriver ? <Bike size={20} /> : <User size={20} />}
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-gray-800 dark:text-gray-100">{emp.name}</h4>
                                                                <p className="text-xs text-gray-500 dark:text-gray-400">{emp.role}</p>
                                                            </div>
                                                        </div>
                                                        {isSelected && <CheckCircle className="text-green-500" size={20} />}
                                                    </div>

                                                    {isSelected && !emp.isDriver && (
                                                        <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800 flex gap-2" onClick={e => e.stopPropagation()}>
                                                            <button 
                                                                onClick={() => updatePeriods(emp.id, 1)}
                                                                className={`flex-1 py-1 text-xs font-bold rounded ${shift.periods === 1 ? 'bg-green-600 text-white shadow' : 'bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-300'}`}
                                                            >
                                                                Meio Período ({formatCurrency(emp.payPerPeriod)})
                                                            </button>
                                                            <button 
                                                                onClick={() => updatePeriods(emp.id, 2)}
                                                                className={`flex-1 py-1 text-xs font-bold rounded ${shift.periods === 2 ? 'bg-green-600 text-white shadow' : 'bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-300'}`}
                                                            >
                                                                Dia Completo ({formatCurrency(emp.payPerPeriod * 2)})
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                        {employees.length === 0 && (
                                            <p className="col-span-full text-center text-gray-400 py-4">Nenhum colaborador cadastrado.</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Add Employee Form & List Actions */}
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-fit">
                                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-gray-700 dark:text-gray-200"><UserPlus /> Novo Colaborador</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome</label>
                                        <input type="text" value={newEmpName} onChange={e => setNewEmpName(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Ex: João Silva" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Função / Cargo</label>
                                        <input type="text" value={newEmpRole} onChange={e => setNewEmpRole(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Ex: Entregador, Pizzaiolo" />
                                    </div>
                                    <div className="flex items-center gap-2 py-2">
                                        <input type="checkbox" id="isDriver" checked={newEmpIsDriver} onChange={e => setNewEmpIsDriver(e.target.checked)} className="w-4 h-4 accent-wine" />
                                        <label htmlFor="isDriver" className="text-sm font-bold text-gray-700 dark:text-gray-300">É Entregador / Motoboy?</label>
                                    </div>
                                    {!newEmpIsDriver && (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor p/ Período (R$)</label>
                                            <input type="number" value={newEmpPay} onChange={e => setNewEmpPay(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="0.00" />
                                        </div>
                                    )}
                                    <button onClick={handleAddEmployee} className="w-full bg-wine hover:bg-wine-light text-white font-bold py-3 rounded-lg shadow mt-2">
                                        ADICIONAR
                                    </button>
                                </div>

                                {/* Manage List (Delete) */}
                                <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
                                    <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-4 text-sm uppercase">Gerenciar Lista</h4>
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                        {employees.map(emp => (
                                            <div key={emp.id} className="flex justify-between items-center text-sm p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded group">
                                                <span className="dark:text-gray-300">{emp.name}</span>
                                                <button onClick={(e) => handleDeleteEmployee(e, emp.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                                    <Trash2 size={16}/>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TAB: CUSTOMERS --- */}
                {activeTab === 'CUSTOMERS' && (
                    <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
                        {/* List */}
                        <div className="lg:col-span-2 flex flex-col h-[calc(100vh-200px)]">
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-4 flex gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                                    <input 
                                        type="text" 
                                        placeholder="Buscar cliente por nome ou telefone..." 
                                        value={customerSearch}
                                        onChange={(e) => setCustomerSearch(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-wine"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-y-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 uppercase text-xs sticky top-0">
                                        <tr>
                                            <th className="p-4">Nome</th>
                                            <th className="p-4">Telefone</th>
                                            <th className="p-4">Endereço</th>
                                            <th className="p-4">Pedidos</th>
                                            <th className="p-4 text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {filteredCustomers.map(cust => (
                                            <React.Fragment key={cust.id}>
                                                <tr className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${expandedCustomerId === cust.id ? 'bg-gray-50 dark:bg-gray-700/50' : ''}`} onClick={() => setExpandedCustomerId(expandedCustomerId === cust.id ? null : cust.id)}>
                                                    <td className="p-4 font-bold text-gray-800 dark:text-gray-200">{cust.name}</td>
                                                    <td className="p-4 text-gray-600 dark:text-gray-400">{cust.phone}</td>
                                                    <td className="p-4 text-gray-600 dark:text-gray-400 truncate max-w-[200px]">{cust.address} - {cust.neighborhood}</td>
                                                    <td className="p-4 font-bold text-blue-600 dark:text-blue-400">{cust.orderCount || 0}</td>
                                                    <td className="p-4 flex justify-center gap-2" onClick={e => e.stopPropagation()}>
                                                        <button 
                                                            onClick={(e) => handleEditCustomer(e, cust)}
                                                            className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                                                        >
                                                            <Pencil size={16}/>
                                                        </button>
                                                        <button 
                                                            onClick={(e) => handleDeleteCustomer(e, cust.id || '')}
                                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                                        >
                                                            <Trash2 size={16}/>
                                                        </button>
                                                        <button className="p-2 text-gray-400">
                                                            {expandedCustomerId === cust.id ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                                        </button>
                                                    </td>
                                                </tr>
                                                {/* Expanded History Row */}
                                                {expandedCustomerId === cust.id && (
                                                    <tr>
                                                        <td colSpan={5} className="p-0 bg-gray-50 dark:bg-gray-900/50">
                                                            <div className="p-4 border-b border-gray-200 dark:border-gray-700 animate-fade-in">
                                                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><History size={14}/> Histórico de Pedidos Recentes</h4>
                                                                <div className="space-y-2">
                                                                    {getLastOrdersForCustomer(cust).map(o => (
                                                                        <div key={o.id} className="flex items-center justify-between text-sm bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                                                                            <div className="flex gap-4">
                                                                                <span className="font-bold text-wine dark:text-gold">#{o.id}</span>
                                                                                <span className="text-gray-500">{new Date(o.timestamp).toLocaleDateString()}</span>
                                                                                <span className="text-gray-600 dark:text-gray-300 flex items-center gap-1">
                                                                                    {o.items.length} itens ({o.items.map(i => i.product.sabor).join(', ').slice(0, 30)}...)
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex gap-4 items-center">
                                                                                <span className="font-bold">{formatCurrency(o.total)}</span>
                                                                                <button 
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        onRepeatOrder && onRepeatOrder(o);
                                                                                    }}
                                                                                    className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold hover:bg-green-200"
                                                                                >
                                                                                    Repetir
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                    {getLastOrdersForCustomer(cust).length === 0 && <p className="text-gray-400 text-sm italic">Nenhum pedido encontrado no histórico recente.</p>}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Edit/Create Form */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-fit">
                            <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-gray-700 dark:text-gray-200">
                                {editingCustomer ? <><Pencil className="text-blue-500"/> Editar Cliente</> : <><UserPlus className="text-green-500"/> Novo Cliente</>}
                            </h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Completo</label>
                                    <input type="text" value={newCustName} onChange={e => setNewCustName(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefone (Whatsapp)</label>
                                    <input type="text" value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="(15) 99999-9999" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bairro</label>
                                    <input type="text" value={newCustNeighborhood} onChange={e => setNewCustNeighborhood(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Endereço Completo</label>
                                    <textarea value={newCustAddress} onChange={e => setNewCustAddress(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white h-24 resize-none" />
                                </div>
                                
                                <div className="flex gap-2 pt-2">
                                    {editingCustomer && (
                                        <button onClick={handleCancelEditCustomer} className="flex-1 bg-gray-200 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-300">
                                            Cancelar
                                        </button>
                                    )}
                                    <button onClick={handleSaveCustomer} disabled={isBusy} className="flex-1 bg-leaf hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow flex justify-center items-center gap-2">
                                        {isBusy ? <Loader2 className="animate-spin"/> : (editingCustomer ? 'ATUALIZAR' : 'SALVAR')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Global Action Modal (Confirmation) */}
        {confirmModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full border border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">{confirmModal.title}</h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm">{confirmModal.message}</p>
                    <div className="flex gap-3">
                        <button 
                            onClick={closeConfirmModal}
                            disabled={isBusy}
                            className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={executePendingAction}
                            disabled={isBusy}
                            className="flex-1 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center"
                        >
                            {isBusy ? <Loader2 className="animate-spin" size={18} /> : 'Confirmar'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Detail Modal (Shared with Kanban style) - Using Selected Order State */}
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
                    
                    <div className="p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900 flex-1 space-y-4">
                        {/* Just a simple view for CRM purposes */}
                        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                             <p><strong>Cliente:</strong> {selectedOrder.customer.name}</p>
                             <p><strong>Telefone:</strong> {selectedOrder.customer.phone}</p>
                             {selectedOrder.type === 'DELIVERY' && <p><strong>Endereço:</strong> {selectedOrder.customer.address} - {selectedOrder.customer.neighborhood}</p>}
                             <p><strong>Entregador:</strong> {selectedOrder.driverName || '-'}</p>
                             <p><strong>Operador:</strong> {selectedOrder.operatorName || '-'}</p>
                             <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                                 <p className="font-bold mb-1">Itens:</p>
                                 <ul className="list-disc pl-5">
                                     {selectedOrder.items.map((i, idx) => (
                                         <li key={idx}>{i.quantity}x {formatItemName(i.product, i.flavors)}</li>
                                     ))}
                                 </ul>
                             </div>
                             <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2 flex justify-between items-center">
                                 <span className="font-bold">Total:</span>
                                 <span className="text-xl font-bold text-wine dark:text-gold">{formatCurrency(selectedOrder.total)}</span>
                             </div>
                             <p className="text-xs text-gray-500">Pagamento: {getPaymentLabel(selectedOrder.paymentMethod)}</p>
                        </div>
                    </div>
                    
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                         <button 
                             onClick={() => {
                                 onRepeatOrder && onRepeatOrder(selectedOrder);
                                 setSelectedOrder(null);
                             }}
                             className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-green-700"
                         >
                             <RotateCcw size={16}/> Repetir Pedido
                         </button>
                         <button onClick={() => setSelectedOrder(null)} className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg font-bold">Fechar</button>
                    </div>
                </div>
            </div>
        )}

        {/* Alert/Success Toast/Modal */}
        {alertModal && (
            <div className="fixed top-4 right-4 z-[100] bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg animate-fade-in flex items-center gap-2" role="alert">
                <AlertCircle />
                <span className="block sm:inline">{alertModal}</span>
                <button onClick={() => setAlertModal(null)} className="ml-2 font-bold"><X size={16}/></button>
            </div>
        )}
        {successMessage && (
            <div className="fixed top-4 right-4 z-[100] bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded shadow-lg animate-fade-in flex items-center gap-2" role="alert">
                <CheckCircle />
                <span className="block sm:inline">{successMessage}</span>
                <button onClick={() => setSuccessMessage(null)} className="ml-2 font-bold"><X size={16}/></button>
            </div>
        )}
    </div>
  );
};
