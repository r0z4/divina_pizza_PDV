import { db } from "../firebaseConfig";
import { 
    collection, 
    doc, 
    setDoc, 
    deleteDoc, 
    onSnapshot,
    query
} from "firebase/firestore";

const BLOCKED_COLLECTION = "blocked_items";
const LOCAL_STORAGE_KEY = "pizza_divina_blocked";

let forceOfflineMode = false;

export const setInventoryForceOffline = (isOffline: boolean) => {
    forceOfflineMode = isOffline;
};

const dispatchLocalUpdate = () => {
    window.dispatchEvent(new Event("local-inventory-update"));
};

// --- Real-time Listener for Blocked Items ---
export const subscribeToBlockedItems = (callback: (items: string[]) => void) => {
    let unsubscribeFirebase = () => {};
    let usingLocal = false;

    const loadFromLocal = () => {
        try {
            const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
            const items = stored ? JSON.parse(stored) : [];
            callback(items);
        } catch (e) {
            callback([]);
        }
    };

    if (forceOfflineMode) {
        loadFromLocal();
        window.addEventListener("local-inventory-update", loadFromLocal);
        return () => {
             window.removeEventListener("local-inventory-update", loadFromLocal);
        };
    }

    try {
        const q = query(collection(db, BLOCKED_COLLECTION));
        unsubscribeFirebase = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => doc.id);
            callback(items);
        }, (error) => {
            console.warn("Firebase Inventory Error, switching to local:", error);
            usingLocal = true;
            loadFromLocal();
            window.addEventListener("local-inventory-update", loadFromLocal);
        });
    } catch (e) {
        usingLocal = true;
        loadFromLocal();
        window.addEventListener("local-inventory-update", loadFromLocal);
    }

    return () => {
        unsubscribeFirebase();
        if (usingLocal) {
            window.removeEventListener("local-inventory-update", loadFromLocal);
        }
    };
};

// --- Block an Item (Ingredient or Product Name) ---
export const blockItem = async (itemName: string) => {
    if (forceOfflineMode) {
        blockLocalItem(itemName);
        return;
    }

    try {
        await setDoc(doc(db, BLOCKED_COLLECTION, itemName), {
            blockedAt: Date.now()
        });
    } catch (e) {
        console.warn("Firebase Block Item failed, using LocalStorage");
        blockLocalItem(itemName);
    }
};

const blockLocalItem = (itemName: string) => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    const items: string[] = stored ? JSON.parse(stored) : [];
    if (!items.includes(itemName)) {
        items.push(itemName);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
        dispatchLocalUpdate();
    }
};

// --- Unblock an Item ---
export const unblockItem = async (itemName: string) => {
    if (forceOfflineMode) {
        unblockLocalItem(itemName);
        return;
    }

    try {
        await deleteDoc(doc(db, BLOCKED_COLLECTION, itemName));
    } catch (e) {
        console.warn("Firebase Unblock Item failed, using LocalStorage");
        unblockLocalItem(itemName);
    }
};

const unblockLocalItem = (itemName: string) => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
        let items: string[] = JSON.parse(stored);
        items = items.filter(i => i !== itemName);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
        dispatchLocalUpdate();
    }
};