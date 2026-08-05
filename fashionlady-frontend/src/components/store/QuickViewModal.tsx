import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart, Minus, Plus, ShoppingBag } from "lucide-react";
import { useQuickView } from "@/contexts/QuickViewContext";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { cn } from "@/lib/utils";
import {
    getActiveVariants,
    getProductGallery,
    getVariantAwareProduct,
    getProductDiscountPercent,
    getVariantStock,
} from "@/lib/product-variants";

const UNSTITCHED_SIZE = "Unstitch";

function getProductSizeInfo(sizes?: string[] | null) {
    const productSizes = sizes?.filter(Boolean) ?? [];
    const isUnstitched = productSizes.some((s) => s.toLowerCase() === UNSTITCHED_SIZE.toLowerCase());

    return {
        isUnstitched,
        sizes: isUnstitched ? [] : productSizes.length > 0 ? productSizes : ["Standard"],
        defaultSize: isUnstitched ? UNSTITCHED_SIZE : productSizes[0] || "Standard",
    };
}

export const QuickViewModal = () => {
    const router = useRouter();
    const { product, close } = useQuickView();
    const { addItem } = useCart();
    const { has, toggle } = useWishlist();
    const [size, setSize] = useState<string | null>(null);
    const [color, setColor] = useState<string | null>(null);
    const [qty, setQty] = useState(1);
    const [activeImg, setActiveImg] = useState(0);
    const activeVariants = useMemo(() => getActiveVariants(product), [product]);
    const descriptionLines = product?.description
        ? product.description
              .replace(/\s+/g, " ")
              .trim()
              .split(/(?<=[.!?])\s+/)
              .filter(Boolean)
        : [];

    useEffect(() => {
        if (product) {
            const firstVariant = activeVariants[0];
            const { defaultSize } = getProductSizeInfo(product.sizes);
            setSize(firstVariant?.size || defaultSize);
            setColor(firstVariant?.color || (product.colors?.filter(Boolean)[0] ?? null));
            setQty(1);
            setActiveImg(0);
        }
    }, [product, activeVariants]);

    useEffect(() => {
        if (activeVariants.length === 0 || !size) return;
        const nextColors = activeVariants
            .filter((variant) => variant.size === size)
            .map((variant) => variant.color)
            .filter(Boolean);
        if (nextColors.length > 0 && !nextColors.includes(color || "")) {
            setColor(nextColors[0] || null);
        }
    }, [activeVariants, color, size]);

    if (!product) return null;
    const wished = has(product.id);
    const brandName = product.brand?.name ?? "";
    const sizeInfo =
        activeVariants.length > 0
            ? {
                  isUnstitched: false,
                  sizes: Array.from(new Set(activeVariants.map((variant) => variant.size).filter(Boolean))) as string[],
                  defaultSize: activeVariants[0]?.size || "Standard",
              }
            : getProductSizeInfo(product.sizes);
    const colors =
        activeVariants.length > 0
            ? Array.from(
                  new Set(
                      activeVariants
                          .filter((variant) => variant.size === size)
                          .map((variant) => variant.color)
                          .filter(Boolean),
                  ),
              )
            : product.colors?.filter(Boolean) ?? [];
    const selectedVariant = activeVariants.find((variant) => {
        const sameSize = variant.size === size;
        const sameColor = colors.length > 0 ? (variant.color || "") === (color || "") : true;
        return sameSize && sameColor;
    });
    const baseGallery = getProductGallery(product);
    const { displayPrice, displayImages, cartProduct } = getVariantAwareProduct(product, selectedVariant);
    const gallery = displayImages.length > 0 ? displayImages : baseGallery;
    const variantStock = getVariantStock(selectedVariant);
    const isOutOfStock = selectedVariant
        ? variantStock === 0 || selectedVariant.active === false
        : product.stockQty === 0 || product.stock === "unavailable";
    const displayOldPrice = cartProduct.oldPrice ?? null;
    const discountPercent = getProductDiscountPercent(product, selectedVariant);

    return (
        <Dialog open={!!product} onOpenChange={(o) => !o && close()}>
            <DialogContent className="max-w-4xl w-[95vw] sm:w-full p-0 overflow-hidden gap-0 bg-background max-h-[90vh]">
                <DialogTitle className="sr-only">{product.name}</DialogTitle>
                <DialogDescription className="sr-only">{product.description}</DialogDescription>

                <div className="grid md:grid-cols-2 max-h-[90vh] overflow-y-auto">
                    <div className="relative flex-shrink-0 flex flex-col self-start">
                        {(discountPercent > 0 || product.badge) && !isOutOfStock && (
                            <span className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10 bg-accent text-accent-foreground text-[8px] sm:text-[10px] font-semibold tracking-wider uppercase px-2.5 py-1">
                                {discountPercent > 0 ? `${discountPercent}% Off` : product.badge}
                            </span>
                        )}
                        {isOutOfStock && (
                            <div className="absolute inset-0 z-20 bg-background/40 backdrop-blur-[2px] flex items-center justify-center">
                                <span className="bg-primary text-primary-foreground text-xs font-bold tracking-[0.2em] uppercase px-4 py-2 shadow-xl border border-primary-foreground/20">
                                    Stock Out
                                </span>
                            </div>
                        )}
                        <div className="relative w-full max-w-full aspect-[3/4]">
                            <Image
                                src={gallery[activeImg]}
                                alt={product.name}
                                fill
                                sizes="(min-width: 768px) 50vw, 95vw"
                                className={cn("object-contain", isOutOfStock && "opacity-60")}
                            />
                        </div>
                        {gallery.length > 1 && (
                            <div className="flex flex-wrap gap-2 p-2">
                                {gallery.map((src, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setActiveImg(i)}
                                        className={cn(
                                            "relative inline-flex shrink-0 overflow-hidden bg-background items-start justify-start",
                                            activeImg === i ? "" : "",
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "relative inline-flex w-16 aspect-[2/3] overflow-hidden border-2 transition-all",
                                                activeImg === i
                                                    ? "border-primary"
                                                    : "border-transparent hover:border-primary/40",
                                            )}
                                        >
                                            <Image src={src} alt="" fill sizes="64px" className="object-contain" />
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-5 sm:p-6 md:p-10 md:overflow-y-auto space-y-5">
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.2em] text-accent font-medium">{brandName}</p>
                            <h2 className="font-serif text-3xl text-primary leading-tight">{product.name}</h2>
                            <div className="flex items-baseline gap-3 pt-1">
                                <span className="text-2xl font-medium text-primary">
                                    BDT {displayPrice.toLocaleString()}
                                </span>
                                {displayOldPrice && displayOldPrice > displayPrice && (
                                    <span className="text-lg text-muted-foreground line-through">
                                        BDT {displayOldPrice.toLocaleString()}
                                    </span>
                                )}
                                {discountPercent > 0 && (
                                    <span className="bg-primary px-2 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground">
                                        {discountPercent}% Off
                                    </span>
                                )}
                            </div>
                        </div>

                        {descriptionLines.length > 0 && (
                            <div className="text-sm text-muted-foreground leading-7 border-t border-border pt-5">
                                {descriptionLines.map((line, index) => (
                                    <p key={`${index}-${line}`}>{line}</p>
                                ))}
                            </div>
                        )}
                        {/* Stitch and size selector */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-xs uppercase tracking-wider text-foreground font-medium">Size</p>
                            </div>
                            {sizeInfo.isUnstitched ? (
                                <div className="inline-flex h-11 items-center border border-primary bg-primary px-4 text-sm font-medium text-primary-foreground">
                                    {UNSTITCHED_SIZE}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex flex-wrap gap-2">
                                        {sizeInfo.sizes.map((s) => (
                                            <button
                                                key={s}
                                                disabled={isOutOfStock}
                                                onClick={() => setSize(s)}
                                                className={cn(
                                                    "h-11 min-w-[44px] px-3 border text-sm font-medium transition-all",
                                                    size === s
                                                        ? "border-primary bg-primary text-primary-foreground"
                                                        : "border-border hover:border-primary",
                                                    isOutOfStock && "opacity-50 cursor-not-allowed",
                                                )}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {colors.length > 0 && (
                            <div className="space-y-3">
                                <p className="text-xs uppercase tracking-wider text-foreground font-medium">Color</p>
                                <div className="flex flex-wrap gap-2">
                                    {colors.map((item) => (
                                        <button
                                            key={item}
                                            disabled={isOutOfStock}
                                            onClick={() => setColor(item)}
                                            className={cn(
                                                "h-10 min-w-[72px] px-3 border text-sm font-medium transition-all",
                                                color === item
                                                    ? "border-primary bg-primary text-primary-foreground"
                                                    : "border-border hover:border-primary",
                                                isOutOfStock && "opacity-50 cursor-not-allowed",
                                            )}
                                        >
                                            {item}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Quantity */}
                        <div className="space-y-3">
                            <p className="text-xs uppercase tracking-wider text-foreground font-medium">Quantity</p>
                            <div className="inline-flex items-center border border-border">
                                <button
                                    disabled={isOutOfStock}
                                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                                    aria-label="Decrease quantity"
                                    className="h-11 w-11 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50"
                                >
                                    <Minus className="h-4 w-4" />
                                </button>
                                <span className="w-12 text-center font-medium tabular-nums">
                                    {isOutOfStock ? 0 : qty}
                                </span>
                                <button
                                    disabled={isOutOfStock}
                                    onClick={() => setQty((q) => q + 1)}
                                    aria-label="Increase quantity"
                                    className="h-11 w-11 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50"
                                >
                                    <Plus className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-row gap-3 pt-2">
                            <Button
                                size="lg"
                                className="flex-1 min-w-0 rounded-none h-12 bg-primary hover:bg-primary-glow"
                                disabled={!size || isOutOfStock}
                                onClick={() => {
                                    if (!size) return;
                                    addItem(cartProduct, color ? `${size} / ${color}` : size, qty);
                                    close();
                                }}
                            >
                                <ShoppingBag className="h-4 w-4" />
                                {isOutOfStock ? "Out of Stock" : "Add to Cart"}
                            </Button>
                            <Button
                                size="lg"
                                variant="outline"
                                className={cn(
                                    "rounded-none h-12 w-12 flex-shrink-0 border-primary",
                                    wished &&
                                        "bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90",
                                )}
                                onClick={() => toggle(product.id, product.name)}
                                aria-label="Toggle wishlist"
                            >
                                <Heart className={cn("h-4 w-4", wished && "fill-current")} />
                            </Button>
                        </div>

                        <Button
                            size="lg"
                            className="w-full rounded-none h-12 bg-accent hover:bg-accent/90"
                            disabled={!size || isOutOfStock}
                            onClick={() => {
                                if (!product || !size) return;
                                addItem(cartProduct, color ? `${size} / ${color}` : size, qty, true);
                                close();
                                router.push("/checkout");
                            }}
                        >
                            Checkout Now
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
