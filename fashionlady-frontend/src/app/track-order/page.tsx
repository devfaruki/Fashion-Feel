"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { FormEvent, useState } from "react";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, CheckCircle2, Truck, MapPin, Clock, AlertCircle, Loader2, Search } from "lucide-react";
import { api } from "@/lib/api";

type Step = { i: any; t: string; d: string; done: boolean; current?: boolean; error?: boolean };

// Ensure this matches the Order type
type Order = {
  id: number;
  totalPrice: number;
  deliveryCharge: number;
  orderStatus: string;
  orderDate: string;
  courierDetails?: {
    tracking_code?: string;
  };
};

export default function TrackOrder() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const data = new FormData(e.target as HTMLFormElement);
    const phoneInput = String(data.get("phone") || "").trim();
    
    if (!phoneInput) return;

    const normalizePhone = (p: string) => {
      let cleaned = p.replace(/\D/g, ""); // Remove all non-digits
      if (cleaned.startsWith("880")) {
        cleaned = cleaned.substring(2); // Remove '88' but keep '0' -> '01...'
      }
      if (cleaned.length === 10 && !cleaned.startsWith("0")) {
        cleaned = "0" + cleaned;
      }
      return cleaned;
    };

    const phone = normalizePhone(phoneInput);

    setLoading(true);
    setError(null);
    setHasSearched(true);
    
    try {
      const res = await api.get(`/order/track-order/${phone}`);
      setOrders(res.data?.data || []);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setOrders([]);
      } else {
        setError(err.response?.data?.message || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const getSteps = (status: string): Step[] => {
    const isCancelled = status === "CANCELLED";
    
    if (isCancelled) {
      return [
        { i: CheckCircle2, t: "Order placed", d: "We've received your order", done: true },
        { i: AlertCircle, t: "Cancelled", d: "This order has been cancelled", done: true, error: true },
      ];
    }

    const isShipped = status === "SHIPPED" || status === "DELIVERED";
    const isDelivered = status === "DELIVERED";

    return [
      { i: CheckCircle2, t: "Order placed", d: "We've received your order", done: true },
      { i: Package, t: "Packed", d: "Your parcel is prepared", done: isShipped, current: status === "PENDING" },
      { i: Truck, t: "Shipped", d: "Courier is on the way", done: isDelivered, current: status === "SHIPPED" },
      { i: MapPin, t: "Delivered", d: "Enjoy your new outfit", done: isDelivered, current: status === "DELIVERED" },
    ];
  };

  const formatBDT = (amount: number) =>
    new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 0 }).format(amount);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pb-24">
        <section className="container py-12 md:py-16 text-center">
          <p className="text-xs tracking-[0.3em] uppercase text-accent mb-3">Order status</p>
          <h1 className="font-serif text-4xl md:text-5xl text-foreground">Track Your Order</h1>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
            Enter your phone number or Order ID to see the status of your recent orders.
          </p>
        </section>

        <section className="container max-w-2xl">
          <form onSubmit={onSubmit} className="bg-card border border-border p-6 md:p-8 space-y-5 shadow-soft">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number or Order ID</Label>
              <Input id="phone" name="phone" required placeholder="e.g. 017xxxxxxxx or 1234" className="h-12" />
            </div>
            <Button type="submit" size="lg" className="w-full h-12" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Search className="h-5 w-5 mr-2" />}
              Track Orders
            </Button>
          </form>

          {error && (
            <div className="mt-8 p-4 bg-destructive/10 text-destructive text-center rounded-xl border border-destructive/20 animate-fade-in">
              {error}
            </div>
          )}

          {!loading && hasSearched && orders.length === 0 && !error && (
            <div className="mt-8 p-8 bg-card border border-border text-center rounded-xl shadow-soft animate-fade-in">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <h3 className="font-serif text-xl mb-2">No orders found</h3>
              <p className="text-muted-foreground">We couldn't find any orders linked to this phone number or ID.</p>
            </div>
          )}

          <div className="mt-10 space-y-6 animate-fade-in">
            {orders.map((order) => {
              const orderSteps = getSteps(order.orderStatus);
              const isCancelled = order.orderStatus === "CANCELLED";
              const isDelivered = order.orderStatus === "DELIVERED";
              
              return (
                <div key={order.id} className="bg-card border border-border p-6 md:p-8 shadow-soft overflow-hidden relative">
                  {/* Status Badge Background */}
                  <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl -z-10 rounded-full opacity-20 ${
                    isCancelled ? "bg-red-50" : isDelivered ? "bg-green-50" : "bg-primary"
                  }`} />
                  
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8 border-b border-border pb-6">
                    <div>
                      <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-1">Order</p>
                      <p className="font-serif text-2xl md:text-3xl text-foreground">FL-{String(order.id).padStart(4, "0")}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Placed on {new Date(order.orderDate).toLocaleDateString("en-BD", { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    
                    <div className="text-left sm:text-right">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
                        isCancelled ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400" :
                        isDelivered ? "bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400" :
                        "bg-primary/10 text-primary"
                      }`}>
                        {isCancelled ? <AlertCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />} 
                        {order.orderStatus}
                      </span>
                      <p className="font-medium text-lg mt-2">{formatBDT(order.totalPrice)}</p>
                    </div>
                  </div>

                  <div className="bg-secondary/10 rounded-xl p-5 md:p-8 border border-border/50">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-8 text-center md:text-left">Order Progress</h4>
                    
                    <div className="relative">
                      {/* Dynamic Background Line (bridges centers) */}
                      <div 
                        className="absolute top-[1.375rem] h-0.5 bg-border hidden md:block" 
                        style={{ 
                          left: `${100 / (orderSteps.length * 2)}%`, 
                          right: `${100 / (orderSteps.length * 2)}%` 
                        }} 
                      />
                      <div 
                        className="absolute left-[1.375rem] w-0.5 bg-border md:hidden" 
                        style={{ 
                          top: "22px", 
                          bottom: "22px" 
                        }} 
                      />
                      
                      <ol className="relative flex flex-col md:flex-row justify-between gap-8 md:gap-4 max-w-2xl mx-auto">
                        {orderSteps.map((s, i) => {
                          const Icon = s.i;
                          const isDone = s.done && !s.current;
                          const isCurrent = s.current;
                          const isError = s.error;

                          // Step specific colors
                          const stepColors = [
                            { c: "text-blue-500", b: "border-blue-500", bg: "bg-blue-50", shadow: "rgba(59,130,246,0.2)" },
                            { c: "text-amber-500", b: "border-amber-500", bg: "bg-amber-50", shadow: "rgba(245,158,11,0.2)" },
                            { c: "text-purple-500", b: "border-purple-500", bg: "bg-purple-50", shadow: "rgba(168,85,247,0.2)" },
                            { c: "text-emerald-500", b: "border-emerald-500", bg: "bg-emerald-50", shadow: "rgba(16,185,129,0.2)" }
                          ];
                          
                          const style = isError ? { c: "text-red-500", b: "border-red-500", bg: "bg-red-50", shadow: "rgba(239,68,68,0.2)" } : stepColors[i] || stepColors[0];
                          const active = isDone || isCurrent;
                          
                          return (
                            <li key={s.t} className="relative flex flex-row md:flex-col items-start md:items-center gap-4 md:gap-3 flex-1">
                              {/* Colored Connector (Desktop) */}
                              {i > 0 && active && (
                                <div 
                                  className={`absolute top-[1.375rem] right-1/2 w-full h-0.5 hidden md:block ${
                                    style.bg.replace('50', '500')
                                  }`} 
                                />
                              )}

                              {/* Colored Connector (Mobile) */}
                              {i > 0 && active && (
                                <div 
                                  className={`absolute left-[1.375rem] bottom-1/2 h-full w-0.5 md:hidden ${
                                    style.bg.replace('50', '500')
                                  }`} 
                                />
                              )}
                              
                              <div className="flex flex-col items-center relative z-10">
                                <div
                                  className={`h-11 w-11 rounded-full flex items-center justify-center border-2 bg-card transition-all duration-500 ${
                                    active || isError
                                      ? `${style.b} ${style.c} ${style.bg}`
                                      : "border-border text-muted-foreground"
                                  } ${isCurrent ? `ring-4 ring-offset-0 ring-primary/20 animate-pulse ${style.b}` : ""}`}
                                  style={{ 
                                    ...(isCurrent ? { animationDuration: '3s' } : {}),
                                    ...(active || isError ? { boxShadow: `0 0 15px ${style.shadow}` } : {})
                                  }}
                                >
                                  <Icon className="h-5 w-5" />
                                </div>
                              </div>
                              
                              <div className="md:text-center">
                                <p className={`font-semibold text-sm md:text-base ${
                                  active || isError ? style.c.replace('text-', 'text-') : "text-muted-foreground"
                                }`}>
                                  {s.t}
                                </p>
                                <p className="text-xs text-muted-foreground md:max-w-[120px] mx-auto mt-0.5">{s.d}</p>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </div>

                    {order.courierDetails?.tracking_code && (
                      <div className="mt-6 pt-4 border-t border-border flex flex-col gap-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Live Tracking Link</p>
                        <a 
                          href={`https://steadfast.com.bd/t/${order.courierDetails.tracking_code}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <Truck className="h-4 w-4" /> Steadfast: {order.courierDetails.tracking_code}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
