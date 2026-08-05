"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Truck } from "lucide-react";
import { getPrimaryImage } from "@/lib/product-images";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { normalizeMetaPhone, trackInitiateCheckout, trackPurchase } from "@/lib/meta-events";
import {
  BANGLADESH_DISTRICTS,
  DISTRICT_UPAZILAS,
  getDeliveryChargeForDistrict,
} from "@/lib/bangladesh-address";

export default function Checkout() {
  const { items, subtotal, clear } = useCart();
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [orderId, setOrderId] = useState<string>("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [district, setDistrict] = useState("");
  const [thana, setThana] = useState("");
  const [deliveryCharge, setDeliveryCharge] = useState<number | null>(null);
  const didTrackCheckoutRef = useRef(false);

  const shipping = deliveryCharge ?? 0;
  const total = subtotal + (shipping || 0);
  const districtOptions = useMemo(() => [...BANGLADESH_DISTRICTS], []);

  const upazilaOptions = useMemo(() => {
    if (!district) return [];
    return DISTRICT_UPAZILAS[district] || [];
  }, [district]);

  // Reset thana when district changes
  useEffect(() => {
    setThana("");
  }, [district]);

  // Recalculate delivery charge when district or thana changes
  useEffect(() => {
    if (!district) {
      setDeliveryCharge(null);
      return;
    }
    setDeliveryCharge(getDeliveryChargeForDistrict(district, thana));
  }, [district, thana]);

  useEffect(() => {
    if (!items.length || didTrackCheckoutRef.current) return;

    // Fire once per checkout page visit so ad platforms can attribute funnel starts.
    trackInitiateCheckout(items, total, shipping);
    didTrackCheckoutRef.current = true;
  }, [items, shipping, total]);

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

  const validatePhone = (p: string) => {
    const normalized = normalizePhone(p);
    return /^01[3-9]\d{8}$/.test(normalized);
  };

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || name.trim().length < 2) {
      toast.error("Please enter your full name.");
      return;
    }
    if (!phone || !validatePhone(phone)) {
      toast.error("Please enter a valid Bangladeshi phone number.");
      return;
    }
    if (!address || address.trim().length < 5) {
      toast.error("Please enter a valid address.");
      return;
    }
    if (!district) {
      toast.error("Please select your district.");
      return;
    }
    if (!thana || thana.trim().length < 2) {
      toast.error("Please select or enter your thana/upazila.");
      return;
    }
    if (deliveryCharge === null) {
      toast.error("Please select delivery location (inside/outside Dhaka).");
      return;
    }

    setProcessing(true);
    try {
      // Build order items with productId and quantity
      const orderItems = items.map((item) => {
        const [variantSize, ...colorParts] = item.size.split("/").map((part) => part.trim());

        return {
          productId: item.product.id,
          quantity: item.quantity,
          name: item.product.name,
          price: item.product.price,
          size: item.size,
          variantSize: variantSize || item.size,
          variantColor: colorParts.join(" / "),
          image: getPrimaryImage(item.product),
        };
      });

      const payload = {
        // Customer info
        name: name.trim(),
        phone: normalizePhone(phone),
        address: address.trim(),
        district: district.trim(),
        thana: thana.trim(),
        deliveryCharge: Number(deliveryCharge),
        // Order info
        totalPrice: total,
        paymentMethod: "CASHON",
        items: orderItems,
      };

      const res = await api.post("/order/add-order", payload);

      // Get the real order ID from the response
      const realOrderId = res.data?.orderId || String(res.data?.data?.id || "");

      const [firstName, ...rest] = name.trim().split(/\s+/);
      const lastName = rest.join(" ");
      const purchaseEventId = realOrderId
        ? `purchase_${realOrderId}`
        : undefined;

      void trackPurchase({
        items,
        total,
        orderId: realOrderId,
        eventId: purchaseEventId,
        userData: {
          phone: normalizeMetaPhone(phone),
          fn: firstName,
          ln: lastName,
          ct: district.trim(),
          country: "bd",
        },
      });

      setOrderId(realOrderId);

      setDone(true);
      clear();
      toast.success("Thank you! We'll contact you shortly.");
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.response?.data?.message || "Failed to submit. Please try again.",
      );
    } finally {
      setProcessing(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 container py-20 flex items-center justify-center">
          <div className="text-center max-w-md animate-scale-in">
            <div className="h-20 w-20 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-accent" />
            </div>
            <h1 className="font-serif text-4xl text-primary mb-3">
              Order Confirmed
            </h1>
            <p className="text-muted-foreground mb-2">
              Thank you for your purchase. We'll contact you shortly to confirm
              delivery.
            </p>
            <p className="text-sm text-accent mb-8">Order #FL-{orderId}</p>
            <div className="flex gap-3 justify-center">
              <Button
                asChild
                className="rounded-none bg-primary hover:bg-primary-glow"
              >
                <Link href="/shop">Continue Shopping</Link>
              </Button>
              <Button
                variant="outline"
                className="rounded-none border-primary"
                onClick={() => router.push("/")}
              >
                Back to Home
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 container py-20 text-center">
          <h1 className="font-serif text-3xl text-primary mb-3">
            Your cart is empty
          </h1>
          <p className="text-muted-foreground mb-6">
            Add items before checking out.
          </p>
          <Button
            asChild
            className="rounded-none bg-primary hover:bg-primary-glow"
          >
            <Link href="/shop">Shop Now</Link>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="bg-secondary border-b border-border">
        <div className="container py-10">
          <h1 className="font-serif text-4xl md:text-5xl text-primary">
            Checkout
          </h1>
        </div>
      </section>

      <div className="container py-10 grid lg:grid-cols-[1fr_400px] gap-12">
        <form onSubmit={placeOrder} className="space-y-8 animate-fade-in">
          <section className="space-y-5">
            <h2 className="font-serif text-2xl text-primary">Contact</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Your name"
                  className="rounded-none h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  type="tel"
                  placeholder="+8801XXXXXXXXX"
                  className="rounded-none h-11"
                />
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <h2 className="font-serif text-2xl text-primary">Shipping</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Address</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                  placeholder="Street address, apartment"
                  className="rounded-none h-11"
                />
              </div>

              <div className="space-y-2">
                <Label>District</Label>
                <Select value={district} onValueChange={setDistrict}>
                  <SelectTrigger className="rounded-none h-11">
                    <SelectValue placeholder="Select district" />
                  </SelectTrigger>
                  <SelectContent>
                    {districtOptions.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Thana / Upazila</Label>
                <Select
                  value={thana}
                  onValueChange={setThana}
                  disabled={!district || upazilaOptions.length === 0}
                >
                  <SelectTrigger className="rounded-none h-11">
                    <SelectValue
                      placeholder={
                        !district
                          ? "Select district first"
                          : "Select thana / upazila"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {upazilaOptions.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-none border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
              BDT 70 for Dhaka City Corporation area, and BDT 130 for the rest of Bangladesh (including Dhaka district outer areas).
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-serif text-2xl text-primary">Payment Method</h2>
            <div className="flex items-center gap-4 p-5 border border-primary bg-secondary/40">
              <Truck className="h-5 w-5 text-accent" />
              <div className="flex-1">
                <p className="font-medium text-primary">Cash on Delivery</p>
                <p className="text-sm text-muted-foreground">
                  Pay BDT {total.toLocaleString()} in cash when your order
                  arrives.
                </p>
              </div>
            </div>
          </section>

          <Button
            type="submit"
            size="lg"
            disabled={processing}
            className="rounded-none h-12 px-8 bg-primary hover:bg-primary-glow w-full sm:w-auto"
          >
            {processing
              ? "Processing…"
              : `Place Order · BDT ${total.toLocaleString()}`}
          </Button>
        </form>

        {/* Summary */}
        <aside className="bg-secondary/40 p-8 h-fit lg:sticky lg:top-32 space-y-5">
          <h2 className="font-serif text-2xl text-primary">Order Summary</h2>
          <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
            {items.map((item) => (
              <div
                key={`${item.product.id}-${item.size}`}
                className="flex gap-3 py-3"
              >
                <div className="relative w-16 h-20 bg-secondary flex-shrink-0">
                  <Image
                    src={getPrimaryImage(item.product)}
                    alt=""
                    fill
                    sizes="64px"
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                    {item.quantity}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-primary line-clamp-1">
                    {item.product.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.size}</p>
                </div>
                <span className="text-sm text-primary font-medium">
                  BDT {(item.product.price * item.quantity).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
          <div className="space-y-2 text-sm border-t border-border pt-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>BDT {subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>{shipping === 0 ? "Free" : `BDT ${shipping}`}</span>
            </div>
            <div className="flex justify-between text-base font-medium pt-2 border-t border-border">
              <span className="text-primary">Total</span>
              <span className="text-primary">BDT {total.toLocaleString()}</span>
            </div>
          </div>
        </aside>
      </div>

      <Footer />
    </div>
  );
}
