import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import type { Product } from "@/types/store";
import { toast } from "sonner";
import { trackAddToCart } from "@/lib/meta-events";

export type CartItem = {
  product: Product;
  size: string;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (
    product: Product,
    size: string,
    quantity?: number,
    silent?: boolean,
  ) => void;
  updateQuantity: (id: number, size: string, quantity: number) => void;
  removeItem: (id: number, size: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);
const STORAGE_KEY = "Fasion Feet.cart.v1";

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setItems(JSON.parse(raw) as CartItem[]);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const addItem = useCallback(
    (product: Product, size: string, quantity = 1, silent = false) => {
      setItems((prev) => {
        const existing = prev.find(
          (i) => i.product.id === product.id && i.size === size,
        );
        if (existing) {
          return prev.map((i) =>
            i.product.id === product.id && i.size === size
              ? { ...i, quantity: i.quantity + quantity }
              : i,
          );
        }
        return [...prev, { product, size, quantity }];
      });

      // Centralized add-to-cart tracking keeps all UI entry points in sync.
      trackAddToCart(product, size, quantity);

      toast.success("Added to cart", {
        description: `${product.name} · ${size}`,
      });
      if (!silent) {
        setIsOpen(true);
      }
    },
    [],
  );

  const updateQuantity = useCallback(
    (id: number, size: string, quantity: number) => {
      setItems((prev) =>
        prev
          .map((i) =>
            i.product.id === id && i.size === size
              ? { ...i, quantity: Math.max(1, quantity) }
              : i,
          )
          .filter((i) => i.quantity > 0),
      );
    },
    [],
  );

  const removeItem = useCallback((id: number, size: string) => {
    setItems((prev) =>
      prev.filter((i) => !(i.product.id === id && i.size === size)),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + i.product.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        count,
        subtotal,
        isOpen,
        openCart,
        closeCart,
        addItem,
        updateQuantity,
        removeItem,
        clear,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
