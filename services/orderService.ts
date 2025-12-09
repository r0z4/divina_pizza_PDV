
import { db, auth } from "../firebaseConfig";
import { 
    collection, 
    addDoc, 
    onSnapshot, 
    query, 
    orderBy, 
    doc, 
    updateDoc, 
    runTransaction,
    where,
    getDocs,
    limit 
} from "firebase/firestore";
import { Order, OrderStatus, Customer } from "../types";
import { findCustomerByPhone } from "./customerService";

const ORDERS_COLLECTION = "orders";
const COUNTERS_COLLECTION = "counters";
const ORDER_COUNTER_DOC = "orderCounter";
const LOCAL_STORAGE_KEY = "pizza_divina_orders";

// --- Global Offline Flag ---
let forceOfflineMode = false;

export const setForceOffline = (isOffline: boolean) => {
    forceOfflineMode = isOffline;
};

// --- Helper for Local Storage Events ---
const dispatchLocalUpdate = () => {
    window.dispatchEvent(new Event("local-orders-update"));
};

const dispatchConnectionError = () => {
    window.dispatchEvent(new Event("firebase-connection-error"));
};

// --- Helper to get raw local data for CSV Export ---
export const getLocalOrders = (): Order[] => {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
};

// --- Find Customer History (Online & Offline) ---
export const findCustomerHistory = async (phone: string): Promise<{ customer: Customer | null, orderCount: number }> => {
    if (!phone || phone.length < 8) return { customer: null, orderCount: 0 };

    try {
        const masterCustomerRecord = await findCustomerByPhone(phone);
        if (masterCustomerRecord) {
            return {
                customer: masterCustomerRecord,
                orderCount: masterCustomerRecord.orderCount || 0
            };
        }
    } catch (e) {
        // Silent fail to allow fallback
    }

    if (forceOfflineMode) {
        const localOrders = getLocalOrders();
        const customerOrders = localOrders.filter(o => o.customer.phone === phone);
        if (customerOrders.length > 0) {
            customerOrders.sort((a, b) => b.timestamp - a.timestamp);
            const lastOrder = customerOrders[0];
            return { 
                customer: lastOrder.customer, 
                orderCount: customerOrders.length 
            };
        }
        return { customer: null, orderCount: 0 };
    }

    try {
        const q = query(collection(db, ORDERS_COLLECTION), where("customer.phone", "==", phone), orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            const count = snapshot.size;
            const lastData = snapshot.docs[0].data() as Order;
            return {
                customer: lastData.customer,
                orderCount: count
            };
        }
        return { customer: null, orderCount: 0 };
    } catch (e) {
        const localOrders = getLocalOrders();
        const count = localOrders.filter(o => o.customer.phone === phone).length;
        return { customer: null, orderCount: count };
    }
};

// --- Real-time Listener ---
export const subscribeToOrders = (callback: (orders: Order[]) => void) => {
    let unsubscribeFirebase = () => {};
    let usingLocal = false;

    const loadFromLocal = () => {
        try {
            const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
            const orders = stored ? JSON.parse(stored) : [];
            orders.sort((a: Order, b: Order) => b.timestamp - a.timestamp);
            callback(orders);
        } catch (e) {
            callback([]);
        }
    };

    if (forceOfflineMode) {
        loadFromLocal();
        window.addEventListener("local-orders-update", loadFromLocal);
        return () => {
             window.removeEventListener("local-orders-update", loadFromLocal);
        };
    }

    try {
        const q = query(collection(db, ORDERS_COLLECTION), orderBy("timestamp", "desc"), limit(500));
        
        unsubscribeFirebase = onSnapshot(q, (snapshot) => {
            const ordersData = snapshot.docs.map(doc => ({
                ...doc.data(),
                docId: doc.id
            })) as Order[];
            callback(ordersData);
        }, (error) => {
            // Check specific database missing error
            if (error.message.includes("database") && error.message.includes("does not exist")) {
                 console.error(`
                 🚨 ERRO DE CONEXÃO COM BANCO DE DADOS:
                 O Firebase retornou que o banco de dados '(default)' não foi encontrado.
                 
                 SE VOCÊ TEM CERTEZA QUE CRIOU O BANCO NO CONSOLE:
                 1. O navegador pode estar com cache antigo. Vá em Configurações > Resetar App & Cache.
                 2. Verifique se o ID do projeto 'pizza-divina-pdv' está correto.
                 3. Verifique se o banco foi criado na localização correta.
                 `);
            } else {
                console.error("🔥 ERRO DE CONEXÃO FIREBASE (Subscribe):", error);
            }
            
            console.warn("Alternando para Modo Offline automaticamente.");
            
            dispatchConnectionError(); // Notify App to switch UI state
            
            // Fallback imediato
            usingLocal = true;
            loadFromLocal();
            window.addEventListener("local-orders-update", loadFromLocal);
        });
    } catch (e) {
        usingLocal = true;
        loadFromLocal();
        window.addEventListener("local-orders-update", loadFromLocal);
    }
    
    return () => {
        unsubscribeFirebase();
        if (usingLocal) {
            window.removeEventListener("local-orders-update", loadFromLocal);
        }
    };
};

// --- Create Order with Atomic ID Increment ---
export const createOrder = async (orderData: Omit<Order, 'id' | 'docId'>): Promise<Order> => {
    if (forceOfflineMode) {
        return Promise.resolve(createLocalOrder(orderData));
    }

    // Aumentado para 15 segundos para evitar timeout em conexões lentas ou primeira conexão
    const timeoutPromise = new Promise<'TIMEOUT'>((resolve) => setTimeout(() => resolve('TIMEOUT'), 15000));

    try {
        // Verificar se estamos autenticados antes de tentar escrever
        if (!auth.currentUser) {
            console.warn("⚠️ Usuário não autenticado no Firebase. Tentando salvar localmente.");
            throw new Error("AUTH_MISSING");
        }

        const transactionPromise = runTransaction(db, async (transaction) => {
            const counterRef = doc(db, COUNTERS_COLLECTION, ORDER_COUNTER_DOC);
            
            let counterDoc;
            try {
                counterDoc = await transaction.get(counterRef);
            } catch (err: any) {
                // Se o documento não existe ou erro de permissão, lançamos para o catch externo
                throw err;
            }
            
            let nextId = 1001; 
            
            if (counterDoc.exists()) {
                const currentCount = counterDoc.data().currentId;
                nextId = currentCount + 1;
                transaction.update(counterRef, { currentId: nextId });
            } else {
                // Cria o contador se não existir
                transaction.set(counterRef, { currentId: nextId });
            }
            return nextId;
        });

        const result = await Promise.race([transactionPromise, timeoutPromise]);

        if (result === 'TIMEOUT') {
            console.error("❌ TIMEOUT FIREBASE: O banco de dados demorou muito para responder.");
            console.warn("Salvando pedido LOCALMENTE para não perder a venda.");
            dispatchConnectionError();
            return createLocalOrder(orderData);
        }

        const newId = result as number;
        const fullOrder: Order = { ...orderData, id: newId };
        const docRef = await addDoc(collection(db, ORDERS_COLLECTION), fullOrder);
        
        console.log("✅ Pedido salvo no Firebase com sucesso! ID:", newId);
        return {
            ...fullOrder,
            docId: docRef.id
        };

    } catch (e: any) {
        // ERROR HANDLING IMPROVEMENT
        if (e.message && e.message.includes("does not exist")) {
             console.error(`
             🔴 ERRO CRÍTICO: BANCO DE DADOS NÃO ENCONTRADO.
             Se já existe, limpe o cache do navegador usando o botão 'Resetar App' nas configurações.
             `);
        } else {
             console.error("🔥 ERRO AO CRIAR PEDIDO NO FIREBASE:", e);
        }
        
        // Se erro de permissão ou não encontrado, pode ser configuração
        // Mas se for erro de rede (offline/blocker), vamos para local
        dispatchConnectionError(); // Notify UI

        console.warn("➡️ Alternando para salvamento LOCAL (Offline) devido ao erro.");
        return Promise.resolve(createLocalOrder(orderData));
    }
};

const createLocalOrder = (orderData: Omit<Order, 'id' | 'docId'>): Order => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    const orders: Order[] = stored ? JSON.parse(stored) : [];
    
    const maxId = orders.length > 0 ? Math.max(...orders.map(o => o.id)) : 1000;
    const newId = maxId + 1;

    const fullOrder: Order = {
        ...orderData,
        id: newId,
        docId: `local_${Date.now()}`
    };

    orders.unshift(fullOrder);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(orders));
    dispatchLocalUpdate();

    return fullOrder;
};

// --- Update Status ---
export const updateOrderStatus = async (orderId: number, newStatus: OrderStatus, cancelReason?: string, driverName?: string, canceledBy?: string) => {
    if (forceOfflineMode) {
        updateLocalOrder(orderId, newStatus, cancelReason, driverName, canceledBy);
        return;
    }

    try {
        const q = query(collection(db, ORDERS_COLLECTION), where("id", "==", orderId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const docRef = querySnapshot.docs[0].ref;
            const updatePayload: any = { status: newStatus };
            
            if (cancelReason) updatePayload.cancelReason = cancelReason;
            if (driverName) updatePayload.driverName = driverName;
            
            if (newStatus === 'CANCELED' && canceledBy) {
                updatePayload.canceledBy = canceledBy;
                updatePayload.canceledAt = Date.now();
            }
            
            await updateDoc(docRef, updatePayload);
        } else {
            // Se não achou no Firebase, pode ser local
            updateLocalOrder(orderId, newStatus, cancelReason, driverName, canceledBy);
        }
    } catch (e) {
        console.warn("Firebase Update failed. Updating LocalStorage.");
        dispatchConnectionError();
        updateLocalOrder(orderId, newStatus, cancelReason, driverName, canceledBy);
    }
};

const updateLocalOrder = (orderId: number, newStatus: OrderStatus, cancelReason?: string, driverName?: string, canceledBy?: string) => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
        let orders: Order[] = JSON.parse(stored);
        orders = orders.map(o => {
            if (o.id === orderId) {
                return {
                    ...o,
                    status: newStatus,
                    cancelReason: cancelReason || o.cancelReason,
                    driverName: driverName || o.driverName,
                    canceledBy: (newStatus === 'CANCELED' ? canceledBy : undefined) || o.canceledBy,
                    canceledAt: (newStatus === 'CANCELED' ? Date.now() : undefined) || o.canceledAt
                };
            }
            return o;
        });
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(orders));
        dispatchLocalUpdate();
    }
};
