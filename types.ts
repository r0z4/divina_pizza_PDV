export type PaymentMethod = 'DINHEIRO' | 'CREDITO' | 'DEBITO' | 'REFEICAO' | 'PIX';

export type OrderStatus = 'CONFIRMED' | 'KITCHEN' | 'DELIVERY' | 'COMPLETED' | 'CANCELED';

export type OrderType = 'DELIVERY' | 'PICKUP';

export interface PizzaSize {
    pedaços: number;
    preco: number;
}
  
export interface Product {
    categoria: string;
    tipo: string;
    sabor: string;
    ingredientes?: string[];
    preco?: number; // Optional because pizzas use 'tamanhos'
    tamanhos?: PizzaSize[]; // Optional because simple items use 'preco'
}

export interface CartItem {
    id: string; // Unique ID for list rendering
    product: Product; // Represents the "primary" flavor or the single item
    flavors?: Product[]; // For split pizzas (contains all selected flavors)
    selectedSize?: number; // 4, 8, or 12 (only for pizzas)
    price: number;
    quantity: number;
    observation?: string; // New field for notes like "Sem cebola"
}

export interface Customer {
    id?: string;
    name: string;
    phone: string;
    address: string;
    totalSpent?: number; // For CRM
    lastOrderDate?: string; // For CRM
    orderCount?: number; // For CRM
}

export interface Order {
    docId?: string; // Firebase Document ID
    id: number; // Human Readable ID (e.g. 1001)
    date: string;
    timestamp: number;
    customer: Customer;
    items: CartItem[];
    subtotal: number;
    deliveryFee: number;
    total: number;
    paymentMethod: PaymentMethod;
    changeFor?: number; // Amount customer is paying with (for change calculation)
    status: OrderStatus;
    cancelReason?: string;
    type: OrderType;
}