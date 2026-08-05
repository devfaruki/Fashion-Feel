import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";
import type { Product } from "@/types/store";

type QuickViewContextValue = {
  product: Product | null;
  open: (p: Product) => void;
  close: () => void;
};

const QuickViewContext = createContext<QuickViewContextValue | undefined>(
  undefined,
);

export const QuickViewProvider = ({ children }: { children: ReactNode }) => {
  const [product, setProduct] = useState<Product | null>(null);

  const open = useCallback((p: Product) => setProduct(p), []);
  const close = useCallback(() => setProduct(null), []);

  return (
    <QuickViewContext.Provider value={{ product, open, close }}>
      {children}
    </QuickViewContext.Provider>
  );
};

export const useQuickView = () => {
  const ctx = useContext(QuickViewContext);
  if (!ctx)
    throw new Error("useQuickView must be used within QuickViewProvider");
  return ctx;
};
