import React, { useMemo, useState } from 'react';
import { ArrowLeft, AlertTriangle, Search, CheckCircle, Ban, PackageOpen } from 'lucide-react';
import { Product } from '../types';
import { blockItem, unblockItem } from '../services/inventoryService';

interface InventoryProps {
  products: Product[];
  blockedItems: string[];
  onBack: () => void;
}

export const Inventory: React.FC<InventoryProps> = ({ products, blockedItems, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'INGREDIENTS' | 'BEVERAGES'>('INGREDIENTS');

  // --- Derive Unique Ingredients from Products ---
  const ingredientsList = useMemo(() => {
    const unique = new Set<string>();
    products.forEach(p => {
        if (p.ingredientes) {
            p.ingredientes.forEach(ing => unique.add(ing));
        }
    });
    return Array.from(unique).sort();
  }, [products]);

  // --- Derive Beverages/Unitary Items ---
  const beveragesList = useMemo(() => {
      return products
        .filter(p => p.categoria === 'Bebida' || !p.ingredientes)
        .map(p => p.sabor)
        .sort();
  }, [products]);

  const toggleItem = (item: string) => {
      if (blockedItems.includes(item)) {
          unblockItem(item);
      } else {
          blockItem(item);
      }
  };

  const currentList = activeTab === 'INGREDIENTS' ? ingredientsList : beveragesList;
  
  const filteredList = currentList.filter(item => 
      item.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen flex flex-col font-sans transition-colors duration-200">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex flex-col md:flex-row justify-between items-center shrink-0 gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-wine dark:text-gray-200"><ArrowLeft /></button>
                <div>
                    <h1 className="text-2xl font-serif text-wine dark:text-gold font-bold flex items-center gap-2">
                        <PackageOpen /> Controle de Estoque
                    </h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Pause ingredientes ou produtos para impedir vendas.</p>
                </div>
            </div>

            {blockedItems.length > 0 && (
                <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold border border-red-200 dark:border-red-800">
                    <AlertTriangle size={18} />
                    {blockedItems.length} itens pausados
                </div>
            )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                
                {/* Search & Tabs */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                        <input 
                            type="text" 
                            placeholder="Buscar item..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-wine outline-none shadow-sm"
                        />
                    </div>
                    <div className="flex bg-white dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700 shrink-0 overflow-x-auto">
                         <button 
                            onClick={() => setActiveTab('INGREDIENTS')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'INGREDIENTS' ? 'bg-wine text-white shadow' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                         >
                             Ingredientes
                         </button>
                         <button 
                            onClick={() => setActiveTab('BEVERAGES')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'BEVERAGES' ? 'bg-wine text-white shadow' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                         >
                             Bebidas / Produtos
                         </button>
                    </div>
                </div>

                {/* List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredList.map(item => {
                        const isBlocked = blockedItems.includes(item);
                        return (
                            <div 
                                key={item} 
                                onClick={() => toggleItem(item)}
                                className={`
                                    p-4 rounded-xl border-2 cursor-pointer transition-all flex justify-between items-center group
                                    ${isBlocked 
                                        ? 'bg-red-50 dark:bg-red-900/10 border-red-500' 
                                        : 'bg-white dark:bg-gray-800 border-transparent hover:border-gray-300 dark:hover:border-gray-600 shadow-sm'}
                                `}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isBlocked ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                        {isBlocked ? <Ban size={20} /> : <CheckCircle size={20} />}
                                    </div>
                                    <div>
                                        <h3 className={`font-bold ${isBlocked ? 'text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-200'}`}>{item}</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {isBlocked ? 'Indisponível (Pausado)' : 'Disponível'}
                                        </p>
                                    </div>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${isBlocked ? 'bg-red-200 text-red-800' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'}`}>
                                    {isBlocked ? 'Falta' : 'OK'}
                                </div>
                            </div>
                        );
                    })}
                    
                    {filteredList.length === 0 && (
                        <div className="col-span-full text-center py-10 text-gray-400">
                            Nenhum item encontrado com este nome.
                        </div>
                    )}
                </div>

            </div>
        </div>
    </div>
  );
};