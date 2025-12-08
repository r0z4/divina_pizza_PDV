
import { db } from "../firebaseConfig";
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

    // 1. Tenta buscar na base oficial de clientes (CRM) primeiro
    // Isso garante que clientes cadastrados via painel sejam encontrados mesmo sem pedidos
    try {
        const masterCustomerRecord = await findCustomerByPhone(phone);
        if (masterCustomerRecord) {
            return {
                customer: masterCustomerRecord,
                orderCount: masterCustomerRecord.orderCount || 0
            };
        }
    } catch (e) {
        console.warn("Falha ao buscar no CRM, tentando fallback para pedidos antigos.", e);
    }

    // 2. Fallback: Se não achar no CRM, busca no histórico de pedidos antigos (Legacy)
    // Isso é útil se o cliente comprou antes do sistema de CRM existir e ainda não foi migrado
    if (forceOfflineMode) {
        // Offline Search
        const localOrders = getLocalOrders();
        const customerOrders = localOrders.filter(o => o.customer.phone === phone);
        if (customerOrders.length > 0) {
            // Get most recent order for details
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
        // Online Search (Legacy Orders)
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
        console.warn("Error fetching customer history:", e);
        // Fallback to local if online query fails
        const localOrders = getLocalOrders();
        const count = localOrders.filter(o => o.customer.phone === phone).length;
        return { customer: null, orderCount: count };
    }
};

// --- Real-time Listener ---
export const subscribeToOrders = (callback: (orders: Order[]) => void) => {
    let unsubscribeFirebase = () => {};
    let usingLocal = false;

    // Local Storage Loader
    const loadFromLocal = () => {
        try {
            const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
            const orders = stored ? JSON.parse(stored) : [];
            // Sort desc by timestamp
            orders.sort((a: Order, b: Order) => b.timestamp - a.timestamp);
            callback(orders);
        } catch (e) {
            console.error("Error loading orders from local storage", e);
            callback([]);
        }
    };

    // If explicitly offline, skip firebase entirely
    if (forceOfflineMode) {
        loadFromLocal();
        window.addEventListener("local-orders-update", loadFromLocal);
        return () => {
             window.removeEventListener("local-orders-update", loadFromLocal);
        };
    }

    try {
        // Try Firebase
        const q = query(collection(db, ORDERS_COLLECTION), orderBy("timestamp", "desc"), limit(500));
        
        unsubscribeFirebase = onSnapshot(q, (snapshot) => {
            const ordersData = snapshot.docs.map(doc => ({
                ...doc.data(),
                docId: doc.id
            })) as Order[];
            callback(ordersData);
        }, (error) => {
            console.warn("Firebase unavailable (Snapshot Error), switching to LocalStorage:", error);
            usingLocal = true;
            loadFromLocal();
            window.addEventListener("local-orders-update", loadFromLocal);
        });
    } catch (e) {
        console.warn("Firebase init failed, using LocalStorage immediately.");
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
    // Check global flag first
    if (forceOfflineMode) {
        return Promise.resolve(createLocalOrder(orderData));
    }

    // Safety Timeout Promise
    const timeoutPromise = new Promise<'TIMEOUT'>((resolve) => setTimeout(() => resolve('TIMEOUT'), 3000));

    try {
        // Race between Firebase Transaction and a 3-second timeout
        const transactionPromise = runTransaction(db, async (transaction) => {
            const counterRef = doc(db, COUNTERS_COLLECTION, ORDER_COUNTER_DOC);
            const counterDoc = await transaction.get(counterRef);
            
            let nextId = 1001; // Default starting ID
            
            if (counterDoc.exists()) {
                const currentCount = counterDoc.data().currentId;
                nextId = currentCount + 1;
                transaction.update(counterRef, { currentId: nextId });
            } else {
                transaction.set(counterRef, { currentId: nextId });
            }
            return nextId;
        });

        // Run the race
        const result = await Promise.race([transactionPromise, timeoutPromise]);

        if (result === 'TIMEOUT') {
            console.warn("Firebase Transaction Timed Out. Saving locally to prevent blocking.");
            return createLocalOrder(orderData);
        }

        // Proceed if transaction succeeded
        const newId = result as number;
        const fullOrder: Order = { ...orderData, id: newId };

        // Save order document (async, non-transactional part)
        // If this also hangs, we are already committed with an ID, but let's just await it.
        const docRef = await addDoc(collection(db, ORDERS_COLLECTION), fullOrder);
        
        return {
            ...fullOrder,
            docId: docRef.id
        };

    } catch (e) {
        console.warn("Firebase Transaction failed. Saving to LocalStorage.", e);
        return Promise.resolve(createLocalOrder(orderData));
    }
};

// Helper for local creation
const createLocalOrder = (orderData: Omit<Order, 'id' | 'docId'>): Order => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    const orders: Order[] = stored ? JSON.parse(stored) : [];
    
    // Generate ID based on max existing ID locally
    const maxId = orders.length > 0 ? Math.max(...orders.map(o => o.id)) : 1000;
    const newId = maxId + 1;

    const fullOrder: Order = {
        ...orderData,
        id: newId,
        docId: `local_${Date.now()}`
    };

    orders.unshift(fullOrder); // Add to beginning
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
            
            // Add cancellation metadata
            if (newStatus === 'CANCELED' && canceledBy) {
                updatePayload.canceledBy = canceledBy;
                updatePayload.canceledAt = Date.now();
            }
            
            await updateDoc(docRef, updatePayload);
        } else {
            // If not found in firebase, try updating local anyway (maybe it was a local order)
            updateLocalOrder(orderId, newStatus, cancelReason, driverName, canceledBy);
        }
    } catch (e) {
        console.warn("Firebase Update failed. Updating LocalStorage.", e);
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