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
import { Order, OrderStatus } from "../types";

const ORDERS_COLLECTION = "orders";
const COUNTERS_COLLECTION = "counters";
const ORDER_COUNTER_DOC = "orderCounter";

// --- Real-time Listener ---
export const subscribeToOrders = (callback: (orders: Order[]) => void) => {
    // Listen to orders ordered by timestamp (newest first)
    // Limits initial load to 500 to prevent performance issues, can be adjusted
    const q = query(collection(db, ORDERS_COLLECTION), orderBy("timestamp", "desc"), limit(500));
    
    return onSnapshot(q, (snapshot) => {
        const ordersData = snapshot.docs.map(doc => ({
            ...doc.data(),
            docId: doc.id
        })) as Order[];
        callback(ordersData);
    });
};

// --- Create Order with Atomic ID Increment ---
export const createOrder = async (orderData: Omit<Order, 'id' | 'docId'>): Promise<Order> => {
    try {
        const newId = await runTransaction(db, async (transaction) => {
            const counterRef = doc(db, COUNTERS_COLLECTION, ORDER_COUNTER_DOC);
            const counterDoc = await transaction.get(counterRef);
            
            let nextId = 1001; // Default starting ID
            
            if (counterDoc.exists()) {
                const currentCount = counterDoc.data().currentId;
                nextId = currentCount + 1;
                transaction.update(counterRef, { currentId: nextId });
            } else {
                // Initialize counter if not exists
                transaction.set(counterRef, { currentId: nextId });
            }
            
            return nextId;
        });

        const fullOrder: Order = {
            ...orderData,
            id: newId
        };

        const docRef = await addDoc(collection(db, ORDERS_COLLECTION), fullOrder);
        
        return {
            ...fullOrder,
            docId: docRef.id
        };

    } catch (e) {
        console.error("Error creating order: ", e);
        throw e;
    }
};

// --- Update Status ---
export const updateOrderStatus = async (orderId: number, newStatus: OrderStatus, cancelReason?: string) => {
    // Since we track by numeric ID in the UI but update by Doc ID in Firestore,
    // we first find the doc (unless we already have the docId in the object, which we should)
    
    const q = query(collection(db, ORDERS_COLLECTION), where("id", "==", orderId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        const docRef = querySnapshot.docs[0].ref;
        const updatePayload: any = { status: newStatus };
        if (cancelReason) updatePayload.cancelReason = cancelReason;
        
        await updateDoc(docRef, updatePayload);
    }
};