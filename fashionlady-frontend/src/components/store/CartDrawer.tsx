import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { getPrimaryImage } from "@/lib/product-images";

export const CartDrawer = () => {
  const {
    items,
    isOpen,
    closeCart,
    updateQuantity,
    removeItem,
    subtotal,
    count,
  } = useCart();

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && closeCart()}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0 bg-background">
        <SheetHeader className="px-6 py-5 border-b border-border">
          <SheetTitle className="font-serif text-2xl flex items-center gap-2 text-primary">
            <ShoppingBag className="h-5 w-5" /> Your Cart
            <span className="text-sm text-muted-foreground font-sans font-normal">
              ({count})
            </span>
          </SheetTitle>
          <SheetDescription className="sr-only">
            Review the items in your cart, adjust quantities, or move
            to checkout.
          </SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4">
            <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center">
              <ShoppingBag className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-serif text-xl text-primary">
                Your cart is empty
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Discover our latest arrivals.
              </p>
            </div>
            <Button
              onClick={closeCart}
              asChild
              className="rounded-none h-11 px-6 bg-primary hover:bg-primary-glow"
            >
              <Link href="/shop">Continue Shopping</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 divide-y divide-border">
              {items.map((item) => (
                <div
                  key={`${item.product.id}-${item.size}`}
                  className="flex gap-4 py-4 animate-fade-in"
                >
                  <Link
                    href="/shop"
                    onClick={closeCart}
                    className="relative flex-shrink-0 w-20 h-24 bg-secondary overflow-hidden"
                  >
                    <Image
                      src={getPrimaryImage(item.product)}
                      alt={item.product.name}
                      fill
                      sizes="80px"
                      className="h-full w-full object-cover"
                    />
                  </Link>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {item.product.brand?.name ?? ""}
                    </p>
                    <h4 className="font-serif text-base text-primary line-clamp-2 leading-tight">
                      {item.product.name}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Size: {item.size}
                    </p>
                    <div className="mt-auto flex items-center justify-between pt-2">
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
                          className="h-7 w-7 flex items-center justify-center hover:bg-muted"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-sm tabular-nums">
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
                          className="h-7 w-7 flex items-center justify-center hover:bg-muted"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="font-medium text-sm text-primary">
                        BDT{" "}
                        {(item.product.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <button
                    aria-label="Remove"
                    onClick={() => removeItem(item.product.id, item.size)}
                    className="text-muted-foreground hover:text-destructive transition-colors self-start"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-border bg-secondary/40 p-6 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium text-primary">
                  BDT {subtotal.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Shipping & taxes calculated at checkout.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  asChild
                  className="rounded-none h-12 bg-primary hover:bg-primary-glow"
                  onClick={closeCart}
                >
                  <Link href="/checkout">
                    Checkout · BDT {subtotal.toLocaleString()}
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="rounded-none h-11 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                  onClick={closeCart}
                >
                  <Link href="/cart">View Cart</Link>
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
