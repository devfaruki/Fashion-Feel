import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { toast } from "sonner";

type WishlistContextValue = {
  ids: number[];
  has: (id: number) => boolean;
  toggle: (id: number, name?: string) => void;
  clear: () => void;
};

const WishlistContext = createContext<WishlistContextValue | undefined>(
  undefined,
);
const STORAGE_KEY = "Fasion Feel.wishlist.v1";

export const WishlistProvider = ({ children }: { children: ReactNode }) => {
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Array<string | number>;
        const normalized = parsed
          .map((value) => Number.parseInt(String(value), 10))
          .filter((value) => Number.isFinite(value));
        setIds(normalized);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  }, [ids]);

  const has = useCallback((id: number) => ids.includes(id), [ids]);

  const toggle = useCallback((id: number, name?: string) => {
    setIds((prev) => {
      if (prev.includes(id)) {
        toast(name ? `Removed ${name}` : "Removed from wishlist");
        return prev.filter((x) => x !== id);
      }
      toast.success(name ? `Saved ${name}` : "Added to wishlist");
      return [...prev, id];
    });
  }, []);

  const clear = useCallback(() => setIds([]), []);

  return (
    <WishlistContext.Provider value={{ ids, has, toggle, clear }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
};
