
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

const dispatchConnectionError = (message?: string) => {
    const event = new CustomEvent("firebase-connection-error", { detail: { message } });
    window.dispatchEvent(event);
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

// --- Helper: Check specific 'Database Not Found' error ---
const isDatabaseMissingError = (error: any) => {
    const msg = error.message || '';
    const code = error.code || '';
    return (
        code === 'not-found' || 
        msg.includes('database') && msg.includes('does not exist') ||
        msg.includes('project') && msg.includes('does not exist')
    );
};

// --- Helper: Sanitize Data for Firestore (Removes Undefined) ---
const sanitizeData = (data: any) => {
    // A maneira mais segura e rápida de remover 'undefined' recursivamente é via JSON serialize/deserialize
    // Isso garante que campos undefined sejam removidos do objeto, evitando o erro do Firestore.
    // Campos 'null' são preservados, o que é aceitável pelo Firestore.
    return JSON.parse(JSON.stringify(data));
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
            // Enhanced Error Log
            if (isDatabaseMissingError(error)) {
                 console.group('%c 🚨 ERRO CRÍTICO DE CONFIGURAÇÃO (Firestore) ', 'background: red; color: white; padding: 4px; border-radius: 2px; font-size: 12px;');
                 console.error('O Banco de Dados (default) não foi encontrado.');
                 console.warn('CAUSA PROVÁVEL: O banco foi criado como "Datastore Mode" ou não foi criado.');
                 console.warn('SOLUÇÃO: O SDK Web exige "Firestore Native Mode". Verifique o console do Firebase.');
                 console.groupEnd();
                 dispatchConnectionError("Banco de Dados não configurado corretamente (Modo Datastore detectado?). Operando Offline.");
            } else {
                console.error("🔥 Erro de conexão Firebase (Subscribe):", error.code);
                dispatchConnectionError();
            }
            
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

    const timeoutPromise = new Promise<'TIMEOUT'>((resolve) => setTimeout(() => resolve('TIMEOUT'), 10000));

    try {
        if (!auth.currentUser) {
            // Check auth silently
        }

        const transactionPromise = runTransaction(db, async (transaction) => {
            const counterRef = doc(db, COUNTERS_COLLECTION, ORDER_COUNTER_DOC);
            
            let counterDoc;
            try {
                counterDoc = await transaction.get(counterRef);
            } catch (err: any) {
                throw err;
            }
            
            let nextId = 1001; 
            
            if (counterDoc.exists()) {
                const currentCount = counterDoc.data().currentId;
                nextId = currentCount + 1;
                transaction.update(counterRef, { currentId: nextId });
            } else {
                transaction.set(counterRef, { currentId: nextId });
            }
            return nextId;
        });

        const result = await Promise.race([transactionPromise, timeoutPromise]);

        if (result === 'TIMEOUT') {
            console.warn("⏱️ Timeout Firebase. Salvando offline.");
            dispatchConnectionError();
            return createLocalOrder(orderData);
        }

        const newId = result as number;
        const fullOrder: Order = { ...orderData, id: newId };
        
        // --- SANITIZAÇÃO DE DADOS (CRÍTICO) ---
        // Garante que nenhum campo 'undefined' seja enviado, evitando erro do Firestore
        const safePayload = sanitizeData(fullOrder);

        const docRef = await addDoc(collection(db, ORDERS_COLLECTION), safePayload);
        
        console.log("✅ Pedido salvo no Firebase! ID:", newId);
        return {
            ...fullOrder,
            docId: docRef.id
        };

    } catch (e: any) {
        // Tratamento silencioso para UI, mas explicativo no console
        if (isDatabaseMissingError(e)) {
             console.log("%c Erro Firestore: Banco não encontrado/compatível. Salvando Localmente. ", "color: orange; font-weight: bold;");
             dispatchConnectionError("Banco de dados ausente ou incompatível. Pedido salvo Localmente.");
        } else {
             // Checagem específica de erro de validação de dados para não confundir com erro de rede
             const msg = e.message || '';
             if (msg.includes('Unsupported field value: undefined')) {
                 console.error("🔥 ERRO DE DADOS CRÍTICO: Tentativa de salvar 'undefined' no Firestore.", e);
                 // Não dispara erro de conexão, pois é um erro de código.
                 // Ainda assim salvamos localmente para não perder a venda.
             } else {
                 console.warn("🔥 Erro Firebase ao criar pedido:", e.message);
                 dispatchConnectionError();
             }
        }
        
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
            updateLocalOrder(orderId, newStatus, cancelReason, driverName, canceledBy);
        }
    } catch (e) {
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
