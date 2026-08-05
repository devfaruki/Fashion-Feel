"use client";

import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ArrowRight, ShoppingBag } from "lucide-react";
import { getPrimaryImage } from "@/lib/product-images";

export default function Cart() {
  const { items, subtotal, updateQuantity, removeItem } = useCart();
  const shipping = subtotal > 5000 || subtotal === 0 ? 0 : 250;
  const total = subtotal + shipping;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="bg-secondary border-b border-border">
        <div className="container py-12">
          <nav className="text-xs tracking-wider uppercase text-muted-foreground mb-3">
            <Link href="/" className="hover:text-primary">
              Home
            </Link>
            <span className="mx-2">/</span>
            <span className="text-primary">Shopping Bag</span>
          </nav>
          <h1 className="font-serif text-4xl md:text-5xl text-primary">
            Shopping Bag
          </h1>
        </div>
      </section>

      <div className="container py-12">
        {items.length === 0 ? (
          <div className="text-center py-20 max-w-md mx-auto">
            <div className="h-24 w-24 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
              <ShoppingBag className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="font-serif text-3xl text-primary mb-3">
              Your cart is empty
            </h2>
            <p className="text-muted-foreground mb-8">
              Looks like you haven't added anything yet. Let's find something
              you'll love.
            </p>
            <Button
              asChild
              className="rounded-none h-12 px-8 bg-primary hover:bg-primary-glow"
            >
              <Link href="/shop">Continue Shopping</Link>
            </Button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_380px] gap-12">
            <div className="divide-y divide-border">
              <div className="hidden md:grid grid-cols-[1fr_140px_120px_40px] gap-4 pb-4 text-xs uppercase tracking-wider text-muted-foreground">
                <span>Product</span>
                <span className="text-center">Quantity</span>
                <span className="text-right">Total</span>
                <span></span>
              </div>

              {items.map((item) => (
                <div
                  key={`${item.product.id}-${item.size}`}
                  className="flex flex-col md:grid md:grid-cols-[1fr_140px_120px_40px] gap-4 py-6 md:items-center animate-fade-in"
                >
                  {/* Product info */}
                  <div className="flex gap-4 items-start">
                    <Link
                      href="/shop"
                      className="relative w-20 h-24 md:w-24 md:h-28 bg-secondary overflow-hidden flex-shrink-0"
                    >
                      <Image
                        src={getPrimaryImage(item.product)}
                        alt={item.product.name}
                        fill
                        sizes="(min-width: 768px) 96px, 80px"
                        className="h-full w-full object-cover"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {item.product.brand?.name ?? ""}
                      </p>
                      <h3 className="font-serif text-lg text-primary leading-tight">
                        {item.product.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Size: {item.size}
                      </p>
                      <p className="text-sm text-primary mt-1 md:hidden">
                        BDT {item.product.price.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Quantity, Price, Delete - stacked on mobile */}
                  <div className="flex items-center justify-between md:flex-col md:gap-0 md:justify-self-center">
                    <span className="text-xs md:hidden text-muted-foreground">
                      Qty
                    </span>
                    <div className="inline-flex items-center border border-border">
                      <button
                        aria-label="Decrease"
                        onClick={() =>
                          updateQuantity(
                            item.product.id,
                            item.size,
                            item.quantity - 1,
                          )
                        }
                        className="h-9 w-9 flex items-center justify-center hover:bg-muted"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-10 text-center text-sm tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        aria-label="Increase"
                        onClick={() =>
                          updateQuantity(
                            item.product.id,
                            item.size,
                            item.quantity + 1,
                          )
                        }
                        className="h-9 w-9 flex items-center justify-center hover:bg-muted"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="flex items-center justify-between md:justify-end">
                    <span className="text-xs md:hidden text-muted-foreground">
                      Total
                    </span>
                    <span className="font-medium text-primary">
                      BDT{" "}
                      {(item.product.price * item.quantity).toLocaleString()}
                    </span>
                  </div>

                  {/* Delete button */}
                  <div className="flex items-center justify-end md:justify-self-end">
                    <button
                      aria-label="Remove"
                      onClick={() => removeItem(item.product.id, item.size)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              <div className="pt-6">
                <Button
                  asChild
                  variant="outline"
                  className="rounded-none border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  <Link href="/shop">← Continue Shopping</Link>
                </Button>
              </div>
            </div>

            {/* Summary */}
            <aside className="bg-secondary/40 p-8 h-fit lg:sticky lg:top-32 space-y-5">
              <h2 className="font-serif text-2xl text-primary">
                Order Summary
              </h2>
              <div className="space-y-3 text-sm border-y border-border py-5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-primary font-medium">
                    BDT {subtotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="text-primary font-medium">
                    {shipping === 0 ? "Free" : `BDT ${shipping}`}
                  </span>
                </div>
                {subtotal > 0 && subtotal < 5000 && (
                  <p className="text-xs text-accent">
                    Add BDT {(5000 - subtotal).toLocaleString()} more for free
                    shipping
                  </p>
                )}
              </div>
              <div className="flex justify-between text-base font-medium">
                <span className="text-primary">Total</span>
                <span className="text-primary">
                  BDT {total.toLocaleString()}
                </span>
              </div>
              <Button
                asChild
                className="w-full rounded-none h-12 bg-primary hover:bg-primary-glow group"
              >
                <Link href="/checkout">
                  Proceed to Checkout
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Secure checkout · Easy returns within 7 days
              </p>
            </aside>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
