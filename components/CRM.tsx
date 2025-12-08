import React, { useMemo, useState, useEffect } from 'react';
import { Order, Customer, PaymentMethod, Employee, ActiveShift, Product } from '../types';
import { Download, Users, Calendar, DollarSign, ArrowLeft, Search, TrendingUp, CreditCard, Wallet, AlertCircle, FileSpreadsheet, ChevronLeft, ChevronRight, ArrowRight, Clock, Plus, Trash2, UserCheck, User, Bike, CheckCircle, Store, BarChart, ShoppingBag, Trophy, Banknote, Smartphone, Globe, Utensils, TrendingDown, Percent, UserPlus, MapPin, Pencil, X, Loader2, History, Pizza, Cookie, CupSoda, NotebookPen, Printer, Timer, Ban, PieChart, ChevronDown, ChevronUp, ShoppingCart, Info } from 'lucide-react';
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
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border