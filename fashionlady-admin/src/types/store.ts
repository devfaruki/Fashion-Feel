export type Category = {
  id: number;
  name: string;
  image?: string | null;
  status?: string | null;
  count?: number;
  _count?: { products: number };
};

export type Brand = {
  id: number;
  name: string;
  image?: string | null;
  status?: string | null;
  count?: number;
  _count?: { products: number };
};

export type Product = {
  id: number;
  productId: number;
  name: string;
  price: number;
  priceRange?: { min: number; max: number } | null;
  oldPriceRange?: { min: number; max: number } | null;
  oldPrice?: number | null;
  badge?: string | null;
  description?: string | null;
  productSummary?: string | null;
  sizes?: string[] | null;
  colors?: string[] | null;
  variants?: Array<{
    size?: string;
    color?: string;
    sku?: string;
    openingStock?: string;
    buyingPrice?: string;
    oldPrice?: string;
    customerPrice?: string;
    extraPrice?: string;
    imageMode?: string;
    image?: string;
    imageUploadIndex?: number;
    active?: boolean;
  }> | null;
  images: string[];
  isNew?: boolean | null;
  isFeatured?: boolean | null;
  stockQty?: number | null;
  stockReserved?: number | null;
  stockAvailable?: number | null;
  categoryId?: number | null;
  brandId?: number | null;
  category?: Category | null;
  brand?: Brand | null;
  stock?: string | null;
};

export type Customer = {
  id: number;
  customerId: string;
  name: string;
  phone: string;
  address: string;
  district?: string | null;
  thana?: string | null;
  createdAt: string;
  orderCount?: number;
  totalSpent?: number;
};

export type Order = {
  id: number;
  customerId: number;
  totalPrice: number;
  deliveryCharge: number;
  district?: string | null;
  thana?: string | null;
  orderStatus: "PENDING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  paymentMethod: "CASHON" | "BKASH";
  items: OrderItem[];
  note?: string | null;
  orderDate: string;
  customer?: Customer;
};

export type OrderItem = {
  productId?: number;
  name?: string;
  product?: string;
  price?: number;
  quantity?: number;
  qty?: number;
  size?: string;
  image?: string;
};

export type HeroSection = {
  id: number;
  title: string;
  subtitle: string;
  buttonText: string;
  buttonUrl: string;
  image: string;
  mobileImage: string;
  order: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
};
