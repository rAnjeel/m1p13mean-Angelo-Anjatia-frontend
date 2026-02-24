export interface ClientCategory {
  key: string;
  label: string;
  icon: string;
}

export interface ClientShop {
  id: number;
  name: string;
  category: string;
  floor: string;
  rating: number;
  hours: string;
  isOpen: boolean;
  icon: string;
  gradient: string;
}

export interface ClientDeal {
  id: number;
  value: string;
  title: string;
  shop: string;
  icon: string;
  gradient: string;
}

export interface ClientProduct {
  id: number;
  shop: string;
  name: string;
  category: string;
  price: string;
  oldPrice?: string;
  badge: string;
  badgeType: 'new' | 'promo' | 'exclusive';
  icon: string;
  gradient: string;
}

export interface ClientService {
  id: number;
  icon: string;
  name: string;
  description: string;
}
