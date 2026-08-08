import { Heart, ShoppingBag, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useQuickView } from "@/contexts/QuickViewContext";
import type { Product } from "@/types/store";
import { cn } from "@/lib/utils";
import { getHoverImage } from "@/lib/product-images";
import {
    getActiveVariants,
    formatProductPrice,
    formatProductOldPrice,
    getDiscountPair,
    getVariantAwareProduct,
    getMaxVariantDiscountPercent,
    getProductDiscountPercent,
    getVariantImage,
    getVariantLabel,
    getVariantStock,
} from "@/lib/product-variants";
import { useEffect, useState } from "react";

export const ProductCard = ({ product, index = 0 }: { product: Product; index?: number }) => {
    const { addItem } = useCart();
    const { has, toggle } = useWishlist();
    const { open } = useQuickView();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const wished = mounted ? has(product.id) : false;
    const activeVariants = getActiveVariants(product);
    const availableVariant =
        activeVariants.find((variant) => {
            const stock = getVariantStock(variant);
            return stock === null || stock > 0;
        }) ?? activeVariants[0];
    const { displayPrice, displayImages, cartProduct } = getVariantAwareProduct(product, availableVariant);
    const primaryImage = displayImages[0];
    const hoverImage =
        activeVariants
            .map((variant) => getVariantImage(variant))
            .find((image) => image && image !== primaryImage) ||
        displayImages[1] ||
        getHoverImage(product);
    const brandName = product.brand?.name ?? "";
    const variantStock = getVariantStock(availableVariant);
    const isOutOfStock =
        activeVariants.length > 0
            ? variantStock === 0 || !availableVariant
            : product.stockQty === 0 || product.stock === "unavailable";
    const discountPercent =
        activeVariants.length > 0
            ? getMaxVariantDiscountPercent(product)
            : getProductDiscountPercent(product);
    const oldPriceLabel =
        activeVariants.length > 0
            ? formatProductOldPrice(product)
            : (() => {
                  const pair = getDiscountPair(product.price, product.oldPrice);
                  return pair.oldPrice ? `BDT ${pair.oldPrice.toLocaleString()}` : "";
              })();
    const defaultVariantLabel = getVariantLabel(
        availableVariant,
        product.sizes && product.sizes.length > 0 ? product.sizes[0] : "Standard",
    );

    return (
        <article
            className={cn("group relative md:animate-fade-in-up", isOutOfStock && "opacity-75")}
            style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
        >
            <div className="relative overflow-hidden bg-secondary aspect-[3/4] mb-4">
                {discountPercent > 0 && !isOutOfStock ? (
                    <span className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10 bg-accent text-white text-[8px] sm:text-[10px] font-semibold tracking-wider uppercase px-2.5 py-1">
                        {discountPercent}%
                    </span>
                ) : product.badge && !isOutOfStock ? (
                    <span className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10 bg-accent text-white text-[8px] sm:text-[10px] font-semibold tracking-wider uppercase px-2.5 py-1">
                        {product.badge}
                    </span>
                ) : null}

                {isOutOfStock && (
                    <div className="absolute inset-0 z-20 bg-background/5 backdrop-blur-[1px] flex items-center justify-center p-4">
                        <span className="bg-primary text-white text-xs sm:text-sm font-bold tracking-[0.2em] uppercase px-2 py-1 sm:px-4 sm:py-2 shadow-xl border border-primary-foreground/20">
                            Stock Out
                        </span>
                    </div>
                )}

                <button
                    aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
                    onClick={(e) => {
                        e.preventDefault();
                        toggle(product.id, product.name);
                    }}
                    className={cn(
                        "absolute top-2 right-2 sm:top-3 sm:right-3 z-10 h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-background/90 backdrop-blur flex items-center justify-center transition-all hover:scale-110",
                        wished ? "text-destructive" : "text-foreground/70 hover:text-destructive",
                    )}
                >
                    <Heart className={cn("h-3 w-3 sm:h-4 sm:w-4 transition-all", wished && "fill-current")} />
                </button>

                <Link
                    href={`/product/${product.id}`}
                    aria-label={product.name}
                    className="relative block h-full w-full"
                >
                    <Image
                        src={primaryImage}
                        alt={product.name}
                        fill
                        sizes="(min-width: 1024px) 25vw, 50vw"
                        className="absolute inset-0 h-full w-full object-cover transition-all duration-700 group-hover:scale-105 group-hover:opacity-0"
                    />
                    <Image
                        src={hoverImage}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 25vw, 50vw"
                        aria-hidden
                        className="absolute inset-0 h-full w-full object-cover opacity-0 transition-all duration-700 group-hover:opacity-100 group-hover:scale-105"
                    />
                </Link>

                {!isOutOfStock && (
                    <div className="absolute inset-x-2 sm:inset-x-3 bottom-2 sm:bottom-3 flex gap-2 md:translate-y-4 md:opacity-0 transition-all duration-500 md:group-hover:translate-y-0 md:group-hover:opacity-100">
                        <Button
                            size="sm"
                            disabled={isOutOfStock}
                            className="flex-1 rounded-none h-8 sm:h-10 bg-primary text-white hover:bg-accent hover:text-white"
                            onClick={() => {
                                addItem(cartProduct, defaultVariantLabel, 1);
                            }}
                        >
                            {isOutOfStock ? (
                                "Unavailable"
                            ) : (
                                <>
                                    <ShoppingBag className="h-3 w-3 sm:h-4 sm:w-4" /> Add to Cart
                                </>
                            )}
                        </Button>
                        <Button
                            size="icon"
                            variant="secondary"
                            className="rounded-none h-8 w-8 sm:h-10 sm:w-10"
                            aria-label="Quick view"
                            onClick={() => open(product)}
                        >
                            <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                    </div>
                )}
            </div>

            <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{brandName}</p>
                <h3 className="font-serif text-lg text-primary line-clamp-1 group-hover:text-accent transition-colors">
                    <Link href={`/product/${product.id}`} className="story-link text-left">
                        {product.name}
                    </Link>
                </h3>
                <div className="flex items-baseline gap-2 pt-1">
                    <span className="text-sm sm:text-base font-medium text-primary">
                        {formatProductPrice(product)}
                    </span>
                    {oldPriceLabel && (
                        <span className="text-xs sm:text-sm text-muted-foreground line-through">
                            {oldPriceLabel}
                        </span>
                    )}
                </div>
            </div>
        </article>
    );
};
