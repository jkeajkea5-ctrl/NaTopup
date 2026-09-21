export interface GameItem {
  id: string;
  slug: string;
  name: string;
  category: string;
  logoUrl: string;
  bannerUrl?: string;
  region: string;
  deliveryTime: string;
  isPopular: boolean;
  _count?: {
    products: number;
  };
}

export interface GameField {
  id: string;
  fieldKey: string;
  fieldLabel: string;
  placeholder: string;
  fieldType: "text" | "select" | "number";
  options?: string[] | null;
  isRequired: boolean;
  helperText?: string;
}

export interface ProductItem {
  id: string;
  sku: string;
  name: string;
  description?: string;
  amount: string;
  iconUrl?: string;
  isPopular: boolean;
  isFeatured: boolean;
  priceUsd: number;
  discountUsd: number;
  finalPriceUsd: number;
  finalPriceKhr: number;
}

export interface PromotionItem {
  id: string;
  title: string;
  badge?: string;
  description?: string;
  bannerUrl?: string;
  targetUrl?: string;
  discountPct: number;
}

export interface OrderStatusData {
  publicOrderId: string;
  status: string;
  customerStatusText: string;
  isTerminal: boolean;
  paymentStatus: string;
  remainingSeconds: number;
  paidAt?: string;
  completedAt?: string;
  timeline: {
    step: string;
    title: string;
    completed: boolean;
    active?: boolean;
    time?: string;
  }[];
}

export interface OrderDetailData {
  publicOrderId: string;
  status: string;
  game: {
    name: string;
    slug: string;
    logoUrl: string;
    instructions?: string;
    deliveryTime?: string;
  };
  product: {
    id: string;
    name: string;
    amount: string;
  };
  playerData: Record<string, string>;
  playerId: string;
  serverId?: string;
  playerName?: string;
  currency: string;
  subtotal: number;
  discount: number;
  total: number;
  totalKhr: number;
  payment?: {
    status: string;
    amount: number;
    amountKhr: number;
    qrPayload: string;
    qrExpiresAt: string;
  };
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  completedAt?: string;
}
