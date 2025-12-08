import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Shield, ShieldAlert, User } from 'lucide-react';
import { SystemUser } from '../types';
import { addUser, deleteUser, getAllUsers, getSession } from '../services/authService';

interface UserManagementProps {
    onBack: () => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ onBack }) => {
    const [users, setUsers] = useState<SystemUser[]>([]);
    const [currentUser, setCurrentUser] = useState<SystemUser | null>(null);
    
    // Modal State
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);

    // Form State
    const [newName, setNewName] = useState('');
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState<'ADMIN' | 'OPERATOR'>('OPERATOR');

    useEffect(() => {
        loadUsers();
        const session = getSession();
        setCurrentUser(session);
    }, []);

    const loadUsers = () => {
        setUsers(getAllUsers());
    };

    const handleAdd = () => {
        if (!newName || !newUsername || !newPassword) {
            alert("Preencha todos os campos."); // Could be custom modal too
            return;
        }

        try {
            addUser({
                name: newName,
                username: newUsername,
                password: newPassword,
                role: newRole
            });
            loadUsers();
            // Reset
            setNewName('');
            setNewUsername('');
            setNewPassword('');
            setNewRole('OPERATOR');
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();

        // Prevent self-delete
        if (currentUser && currentUser.id === id) {
            alert("Você não pode excluir seu próprio usuário logado.");
            return;
        }

        setConfirmModal({
            isOpen: true,
            title: "Excluir Usuário",
            message: "Tem certeza que deseja remover este usuário de acesso?",
            onConfirm: () => {
                try {
                    deleteUser(id);
                    setTimeout(() => loadUsers(), 50); 
                    setConfirmModal(null);
                } catch (e: any) {
                    alert(e.message);
                }
            }
        });
    };

    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen flex flex-col font-sans transition-colors duration-200">
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4 shrink-0">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-wine dark:text-gray-200">
                    <ArrowLeft />
                </button>
                <h1 className="text-xl md:text-2xl font-serif text-wine dark:text-gold font-bold">Gerenciar Usuários de Acesso</h1>
            </div>

            <div className="p-4 md:p-8 max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Form */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-fit">
                    <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-gray-700 dark:text-gray-200">
                        <Plus className="text-orange"/> Novo Usuário
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Completo</label>
                            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Ex: João Silva" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Usuário (Login)</label>
                            <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Ex: joao.silva" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Senha</label>
                            <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="******" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Perfil de Acesso</label>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setNewRole('OPERATOR')}
                                    className={`flex-1 py-2 rounded text-sm font-bold border transition-all ${newRole === 'OPERATOR' ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-gray-50 text-gray-500 border-gray-200'}`}
                                >
                                    Operador
                                </button>
                                <button 
                                    onClick={() => setNewRole('ADMIN')}
                                    className={`flex-1 py-2 rounded text-sm font-bold border transition-all ${newRole === 'ADMIN' ? 'bg-red-100 text-red-700 border-red-300' : 'bg-gray-50 text-gray-500 border-gray-200'}`}
                                >
                                    Admin
                                </button>
                            </div>
                        </div>
                        <button onClick={handleAdd} className="w-full bg-leaf hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow mt-2">
                            CRIAR ACESSO
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="font-bold text-lg mb-6 text-gray-700 dark:text-gray-200">Usuários Cadastrados</h3>
                    <div className="space-y-3">
                        {users.map(user => (
                            <div key={user.id} className="flex justify-between items-center p-4 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 group hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${user.role === 'ADMIN' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                        {user.role === 'ADMIN' ? <ShieldAlert size={20} /> : <User size={20} />}
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-800 dark:text-gray-100">
                                            {user.name} 
                                            {currentUser?.id === user.id && <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-1 rounded border border-green-200 uppercase">Você</span>}
                                        </div>
                                        <div className="text-xs text-gray-500 flex items-center gap-2">
                                            <span className="font-mono">@{user.username}</span>
                                            <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                                            <span className={user.role === 'ADMIN' ? 'text-red-500 font-bold' : 'text-blue-500 font-bold'}>{user.role === 'ADMIN' ? 'Administrador' : 'Operador'}</span>
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    type="button"
                                    onClick={(e) => handleDelete(e, user.id)} 
                                    className={`p-2 rounded-lg transition-colors border border-transparent ${currentUser?.id === user.id ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200'}`}
                                    disabled={currentUser?.id === user.id}
                                    title={currentUser?.id === user.id ? "Você não pode se excluir" : "Excluir Usuário"}
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {/* Confirm Modal */}
            {confirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full border border-gray-200 dark:border-gray-700">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">{confirmModal.title}</h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm">{confirmModal.message}</p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setConfirmModal(null)}
                                className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={confirmModal.onConfirm}
                                className="flex-1 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};