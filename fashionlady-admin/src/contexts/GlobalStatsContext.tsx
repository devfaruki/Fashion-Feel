/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { api } from "@/lib/api";

interface GlobalStats {
  totalOrders: number;
  totalCustomers: number;
  totalProducts: number;
  totalBrands: number;
  totalCategories: number;
  totalReviews: number;
  loading: boolean;
  refresh: () => void;
}

const GlobalStatsContext = createContext<GlobalStats>({
  totalOrders: 0,
  totalCustomers: 0,
  totalProducts: 0,
  totalBrands: 0,
  totalCategories: 0,
  totalReviews: 0,
  loading: true,
  refresh: () => {},
});

export function GlobalStatsProvider({ children }: { children: ReactNode }) {
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalCustomers: 0,
    totalProducts: 0,
    totalBrands: 0,
    totalCategories: 0,
    totalReviews: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get("/dashboard/stats");
      const data = res.data?.data;
      if (data) {
        setStats({
          totalOrders: data.totalOrders ?? 0,
          totalCustomers: data.totalCustomers ?? 0,
          totalProducts: data.totalProducts ?? 0,
          totalBrands: data.totalBrands ?? 0,
          totalCategories: data.totalCategories ?? 0,
          totalReviews: data.totalReviews ?? 0,
        });
      }
    } catch (err) {
      console.error("Failed to fetch global stats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <GlobalStatsContext.Provider
      value={{ ...stats, loading, refresh: fetchStats }}
    >
      {children}
    </GlobalStatsContext.Provider>
  );
}

export function useGlobalStats() {
  return useContext(GlobalStatsContext);
}
