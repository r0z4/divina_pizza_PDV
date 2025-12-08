import { SystemUser } from "../types";

const USERS_STORAGE_KEY = "pizza_divina_sys_users";
const AUTH_SESSION_KEY = "pizza_divina_auth_session";

// Initialize default admin if not exists
export const initializeAuth = () => {
    const stored = localStorage.getItem(USERS_STORAGE_KEY);
    if (!stored) {
        const defaultAdmin: SystemUser = {
            id: 'admin_01',
            username: 'admin',
            password: 'aUSEOTD4BSBSpwd', // Updated Password
            name: 'Administrador Padrão',
            role: 'ADMIN'
        };
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify([defaultAdmin]));
    }
};

export const login = (username: string, pass: string): SystemUser | null => {
    initializeAuth();
    const stored = localStorage.getItem(USERS_STORAGE_KEY);
    const users: SystemUser[] = stored ? JSON.parse(stored) : [];
    
    const user = users.find(u => u.username === username && u.password === pass);
    if (user) {
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
        // Set initial activity timestamp
        localStorage.setItem('pizza_divina_last_activity', Date.now().toString());
        return user;
    }
    return null;
};

export const logout = () => {
    localStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem('pizza_divina_last_activity');
};

export const getSession = (): SystemUser | null => {
    const session = localStorage.getItem(AUTH_SESSION_KEY);
    return session ? JSON.parse(session) : null;
};

// --- User Management (Admin) ---

export const getAllUsers = (): SystemUser[] => {
    initializeAuth();
    const stored = localStorage.getItem(USERS_STORAGE_KEY);
    try {
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error("Auth storage corrupted, resetting");
        return [];
    }
};

export const addUser = (newUser: Omit<SystemUser, 'id'>) => {
    const users = getAllUsers();
    
    if (users.some(u => u.username === newUser.username)) {
        throw new Error("Nome de usuário já existe.");
    }

    const user: SystemUser = {
        ...newUser,
        id: `user_${Date.now()}`
    };

    users.push(user);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    return user;
};

export const deleteUser = (id: string) => {
    let users = getAllUsers();
    // Prevent deleting the last admin
    const userToDelete = users.find(u => u.id === id);
    const adminCount = users.filter(u => u.role === 'ADMIN').length;

    if (userToDelete?.role === 'ADMIN' && adminCount <= 1) {
        throw new Error("Não é possível excluir o último administrador.");
    }

    users = users.filter(u => u.id !== id);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
};