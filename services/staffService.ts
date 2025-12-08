import { db } from "../firebaseConfig";
import { 
    collection, 
    addDoc, 
    deleteDoc, 
    doc, 
    onSnapshot, 
    query, 
    orderBy 
} from "firebase/firestore";
import { Employee } from "../types";

const STAFF_COLLECTION = "employees";
const LOCAL_STORAGE_KEY = "pizza_divina_staff";

// --- Global Offline Flag ---
let forceOfflineMode = false;

export const setStaffForceOffline = (isOffline: boolean) => {
    forceOfflineMode = isOffline;
};

const dispatchLocalUpdate = () => {
    window.dispatchEvent(new Event("local-staff-update"));
};

export const subscribeToEmployees = (callback: (employees: Employee[]) => void) => {
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
        window.addEventListener("local-staff-update", loadFromLocal);
        return () => {
             window.removeEventListener("local-staff-update", loadFromLocal);
        };
    }

    try {
        const q = query(collection(db, STAFF_COLLECTION), orderBy("name"));
        unsubscribeFirebase = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Employee[];
            callback(data);
        }, (error) => {
            console.warn("Firebase Staff Error, switching to local:", error);
            usingLocal = true;
            loadFromLocal();
            window.addEventListener("local-staff-update", loadFromLocal);
        });
    } catch (e) {
        usingLocal = true;
        loadFromLocal();
        window.addEventListener("local-staff-update", loadFromLocal);
    }

    return () => {
        unsubscribeFirebase();
        if (usingLocal) {
            window.removeEventListener("local-staff-update", loadFromLocal);
        }
    };
};

export const addEmployee = async (employee: Omit<Employee, 'id'>) => {
    if (forceOfflineMode) {
        addLocalEmployee(employee);
        return;
    }

    try {
        await addDoc(collection(db, STAFF_COLLECTION), employee);
    } catch (e) {
        console.warn("Firebase Add Staff failed, using LocalStorage");
        addLocalEmployee(employee);
    }
};

const addLocalEmployee = (employee: Omit<Employee, 'id'>) => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    const items: Employee[] = stored ? JSON.parse(stored) : [];
    const newEmployee = { ...employee, id: `local_${Date.now()}` };
    items.push(newEmployee);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    dispatchLocalUpdate();
};

export const deleteEmployee = async (id: string) => {
    // Se for modo offline OU se o ID for local (começa com local_), deleta apenas localmente
    // Isso previne tentar deletar no Firebase um item que só existe no navegador
    if (forceOfflineMode || id.startsWith('local_')) {
        deleteLocalEmployee(id);
        return;
    }

    try {
        await deleteDoc(doc(db, STAFF_COLLECTION, id));
    } catch (e) {
        console.warn("Firebase Delete Staff failed, using LocalStorage fallback logic if applicable");
        // Se falhar no firebase, tenta deletar localmente caso exista lá
        deleteLocalEmployee(id);
    }
};

const deleteLocalEmployee = (id: string) => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
        const items: Employee[] = JSON.parse(stored);
        const filtered = items.filter(i => i.id !== id);
        
        // Só dispara atualização se realmente mudou algo (item existia localmente)
        if (items.length !== filtered.length) {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
            dispatchLocalUpdate();
        }
    }
};