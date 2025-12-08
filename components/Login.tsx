import React, { useState } from 'react';
import { Pizza, Lock, User, LogIn } from 'lucide-react';
import { login } from '../services/authService';
import { SystemUser } from '../types';

interface LoginProps {
    onLoginSuccess: (user: SystemUser) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        const user = login(username, password);
        if (user) {
            onLoginSuccess(user);
        } else {
            setError('Usuário ou senha incorretos.');
        }
    };

    return (
        <div className="min-h-screen bg-wine flex flex-col items-center justify-center p-4">
            <div className="bg-cream dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md border-4 border-gold">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-20 h-20 bg-white rounded-full border-2 border-gold flex items-center justify-center mb-4 shadow-lg">
                        <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain" onError={(e) => e.currentTarget.style.display = 'none'}/>
                        <Pizza className="text-wine w-10 h-10 absolute opacity-0" style={{opacity: 'var(--logo-fallback, 0)'}} /> 
                    </div>
                    <h1 className="text-3xl font-serif font-bold text-wine dark:text-gold text-center">Divina Pizza e Pastéis</h1>
                    <p className="text-gray-500 text-sm font-bold tracking-widest uppercase">Acesso Restrito</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Usuário</label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                            <input 
                                type="text" 
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange outline-none dark:text-white"
                                placeholder="Digite seu usuário"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Senha</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                            <input 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange outline-none dark:text-white"
                                placeholder="Digite sua senha"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-100 text-red-600 p-3 rounded-lg text-sm text-center font-bold border border-red-200">
                            {error}
                        </div>
                    )}

                    <button 
                        type="submit"
                        className="w-full bg-wine hover:bg-wine-light text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform transform active:scale-[0.98]"
                    >
                        <LogIn className="w-5 h-5" /> ENTRAR
                    </button>
                </form>
                
                <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                        Dev. by Tech&Store | Robson Rosa CEO
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono mt-0.5">
                        (15) 98819-5768
                    </p>
                </div>
            </div>
        </div>
    );
};