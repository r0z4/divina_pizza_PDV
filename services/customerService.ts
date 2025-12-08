
import { db } from "../firebaseConfig";
import { 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    orderBy,
    doc,
    deleteDoc,
    where,
    updateDoc
} from "firebase/firestore";
import { Customer } from "../types";

const CUSTOMERS_COLLECTION = "customers";
const LOCAL_STORAGE_KEY = "pizza_divina_customers";

let forceOfflineMode = false;

export const setCustomerForceOffline = (isOffline: boolean) => {
    forceOfflineMode = isOffline;
};

// --- Find Customer By Phone (Public Search) ---
export const findCustomerByPhone = async (phone: string): Promise<Customer | null> => {
    if (forceOfflineMode) {
        return findLocalCustomerByPhone(phone);
    }

    try {
        const q = query(collection(db, CUSTOMERS_COLLECTION), where("phone", "==", phone));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const data = snapshot.docs[0].data() as Customer;
            return { id: snapshot.docs[0].id, ...data };
        }
        return null;
    } catch (e) {
        console.warn("Firebase Customer Search failed, using LocalStorage");
        return findLocalCustomerByPhone(phone);
    }
};

const findLocalCustomerByPhone = (phone: string): Customer | null => {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        const customers: Customer[] = stored ? JSON.parse(stored) : [];
        return customers.find(c => c.phone === phone) || null;
    } catch (e) {
        return null;
    }
};

// --- Add Customer ---
export const addCustomer = async (customer: Customer): Promise<Customer> => {
    // Ensure defaults
    const newCustomer = {
        ...customer,
        orderCount: customer.orderCount || 0,
        totalSpent: 0
    };

    if (forceOfflineMode) {
        return addLocalCustomer(newCustomer);
    }

    try {
        const docRef = await addDoc(collection(db, CUSTOMERS_COLLECTION), newCustomer);
        return { ...newCustomer, id: docRef.id };
    } catch (e) {
        console.warn("Firebase Add Customer failed, using LocalStorage");
        return addLocalCustomer(newCustomer);
    }
};

const addLocalCustomer = (customer: Customer): Customer => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    const customers: Customer[] = stored ? JSON.parse(stored) : [];
    const customerWithId = { ...customer, id: `local_${Date.now()}` };
    customers.push(customerWithId);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(customers));
    return customerWithId;
};

// --- Update Customer (Manual Edit) ---
export const updateCustomer = async (id: string, data: Partial<Customer>) => {
    if (forceOfflineMode || id.startsWith('local_')) {
        updateLocalCustomer(id, data);
        return;
    }

    try {
        const docRef = doc(db, CUSTOMERS_COLLECTION, id);
        await updateDoc(docRef, data);
    } catch (e) {
        console.warn("Firebase Update Customer failed, trying local fallback logic if applicable");
        updateLocalCustomer(id, data);
    }
};

const updateLocalCustomer = (id: string, data: Partial<Customer>) => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
        let customers: Customer[] = JSON.parse(stored);
        const index = customers.findIndex(c => c.id === id);
        if (index !== -1) {
            customers[index] = { ...customers[index], ...data };
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(customers));
        }
    }
};

// --- Save or Update Customer (Called on Order Finish) ---
export const saveOrUpdateCustomer = async (customerData: Customer, orderTotal: number) => {
    if (!customerData.phone) return;

    if (forceOfflineMode) {
        saveOrUpdateLocalCustomer(customerData, orderTotal);
        return;
    }

    try {
        // Query by phone
        const q = query(collection(db, CUSTOMERS_COLLECTION), where("phone", "==", customerData.phone));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            // Update existing
            const docRef = snapshot.docs[0].ref;
            const existingData = snapshot.docs[0].data();
            
            await updateDoc(docRef, {
                name: customerData.name, // Update name in case of correction
                address: customerData.address, // Update address to latest
                neighborhood: customerData.neighborhood || existingData.neighborhood,
                complement: customerData.complement || existingData.complement,
                orderCount: (existingData.orderCount || 0) + 1,
                totalSpent: (existingData.totalSpent || 0) + orderTotal,
                lastOrderDate: new Date().toISOString()
            });
        } else {
            // Create new
            await addDoc(collection(db, CUSTOMERS_COLLECTION), {
                ...customerData,
                orderCount: 1,
                totalSpent: orderTotal,
                lastOrderDate: new Date().toISOString()
            });
        }
    } catch (e) {
        console.warn("Firebase Customer Sync failed, using LocalStorage");
        saveOrUpdateLocalCustomer(customerData, orderTotal);
    }
};

const saveOrUpdateLocalCustomer = (customerData: Customer, orderTotal: number) => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    let customers: Customer[] = stored ? JSON.parse(stored) : [];
    
    const index = customers.findIndex(c => c.phone === customerData.phone);

    if (index >= 0) {
        // Update
        customers[index] = {
            ...customers[index],
            name: customerData.name,
            address: customerData.address,
            neighborhood: customerData.neighborhood || customers[index].neighborhood,
            complement: customerData.complement || customers[index].complement,
            orderCount: (customers[index].orderCount || 0) + 1,
            totalSpent: (customers[index].totalSpent || 0) + orderTotal,
            lastOrderDate: new Date().toISOString()
        };
    } else {
        // Create
        customers.push({
            ...customerData,
            id: `local_${Date.now()}`,
            orderCount: 1,
            totalSpent: orderTotal,
            lastOrderDate: new Date().toISOString()
        });
    }
    
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(customers));
};

// --- Get All Customers ---
export const getCustomers = async (): Promise<Customer[]> => {
    if (forceOfflineMode) {
        return getLocalCustomers();
    }

    try {
        const q = query(collection(db, CUSTOMERS_COLLECTION), orderBy("name"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
    } catch (e) {
        return getLocalCustomers();
    }
};

const getLocalCustomers = (): Customer[] => {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
};

// --- Delete Customer ---
export const deleteCustomer = async (id: string) => {
    if (forceOfflineMode || id.startsWith('local_')) {
        deleteLocalCustomer(id);
        return;
    }

    try {
        await deleteDoc(doc(db, CUSTOMERS_COLLECTION, id));
    } catch (e) {
        deleteLocalCustomer(id);
    }
};

const deleteLocalCustomer = (id: string) => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
        let customers: Customer[] = JSON.parse(stored);
        customers = customers.filter(c => c.id !== id);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(customers));
    }
};
