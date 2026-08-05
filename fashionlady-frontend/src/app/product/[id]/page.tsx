"use client";

import { useEffect, useMemo, useRef, useState, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { ProductCard } from "@/components/store/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
    Heart,
    Minus,
    Plus,
    ShoppingBag,
    Truck,
    RotateCcw,
    ShieldCheck,
    ChevronRight,
    ChevronLeft,
    Star,
    ImagePlus,
    Loader2,
} from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { cn } from "@/lib/utils";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, resolveAssetUrl } from "@/lib/api";
import type { Product } from "@/types/store";
import { Skeleton } from "@/components/ui/skeleton";
import { getProductImages } from "@/lib/product-images";
import {
    getActiveVariants,
    getVariantAwareProduct,
    getProductDiscountPercent,
    getVariantStock,
} from "@/lib/product-variants";
import { toast } from "@/hooks/use-toast";
import { trackViewContent } from "@/lib/meta-events";

interface ProductReview {
    id: number;
    customerName: string;
    rating: number;
    comment: string;
    images: string[];
    status: "PENDING" | "APPROVED" | "CANCELLED";
    createdAt: string;
}

interface ProductReviewListPayload {
    reviews: ProductReview[];
    total: number;
    page: number;
    limit: number;
    averageRating: number;
}

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

export default function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const id = resolvedParams.id;
    const { addItem } = useCart();
    const { has, toggle } = useWishlist();
    const router = useRouter();
    const queryClient = useQueryClient();
    const productId = Number(id);

    const productQuery = useQuery({
        queryKey: ["product", productId],
        queryFn: async () => {
            const { data } = await api.get(`/product/details/${productId}`);
            return data.data as Product;
        },
        enabled: Number.isFinite(productId),
    });

    const product = productQuery.data;
    const activeVariants = useMemo(
        () => getActiveVariants(product),
        [product],
    );

    const gallery = useMemo(() => {
        if (!product) return [];
        const resolvedImages = getProductImages(product);
        const variantImages = (product.variants ?? [])
            .map((variant) => resolveAssetUrl(variant.image))
            .filter((img): img is string => Boolean(img));
        const imgs = [...resolvedImages, ...variantImages];
        return Array.from(new Set(imgs.filter(Boolean)));
    }, [product]);

    const [activeImg, setActiveImg] = useState(0);
    const [size, setSize] = useState<string | null>(null);
    const [color, setColor] = useState<string | null>(null);
    const [qty, setQty] = useState(1);
    const [reviewCustomerName, setReviewCustomerName] = useState("");
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewComment, setReviewComment] = useState("");
    const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
    const [cameraFiles, setCameraFiles] = useState<File[]>([]);
    const [reviewMode, setReviewMode] = useState<"initial" | "ten" | "all">("initial");
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerImages, setViewerImages] = useState<string[]>([]);
    const [viewerIndex, setViewerIndex] = useState(0);
    const [reviewFormOpen, setReviewFormOpen] = useState(false);
    const reviewsLoadMoreRef = useRef<HTMLDivElement | null>(null);
    const trackedViewProductIdRef = useRef<number | null>(null);

    useEffect(() => {
        if (product) {
            const firstVariant = activeVariants[0];
            const { defaultSize } = getProductSizeInfo(product.sizes);
            setSize(firstVariant?.size || defaultSize);
            setColor(firstVariant?.color || product.colors?.filter(Boolean)[0] || null);
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

    useEffect(() => {
        if (!product) return;
        if (trackedViewProductIdRef.current === product.id) return;

        trackViewContent(product);
        trackedViewProductIdRef.current = product.id;
    }, [product]);

    const reviewsQuery = useInfiniteQuery({
        queryKey: ["product-reviews", productId],
        queryFn: async ({ pageParam = 1 }) => {
            const { data } = await api.get(`/review/product/${productId}`, {
                params: { page: pageParam, limit: 10 },
            });

            return data.data as ProductReviewListPayload;
        },
        initialPageParam: 1,
        enabled: Number.isFinite(productId),
        getNextPageParam: (lastPage) => {
            const nextPage = lastPage.page + 1;
            return lastPage.page * lastPage.limit < lastPage.total ? nextPage : undefined;
        },
    });

    const submitReviewMutation = useMutation({
        mutationFn: async (payload: FormData) => {
            const { data } = await api.post("/review/add-review", payload, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            return data;
        },
        onSuccess: async () => {
            setReviewCustomerName("");
            setReviewRating(5);
            setReviewComment("");
            setGalleryFiles([]);
            setCameraFiles([]);

            toast({
                title: "Review submitted",
                description: "Thank you for your review!",
            });

            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: ["product-reviews", productId],
                }),
                queryClient.invalidateQueries({ queryKey: ["product", productId] }),
            ]);
        },
        onError: (error: { response?: { data?: { message?: string } }; message?: string }) => {
            const message = error?.response?.data?.message || error?.message || "Failed to submit review";

            toast({
                title: "Review submission failed",
                description: message,
                variant: "destructive",
            });
        },
    });

    const fetchedReviews = useMemo(() => reviewsQuery.data?.pages.flatMap((p) => p.reviews) ?? [], [reviewsQuery.data]);
    const totalReviews = reviewsQuery.data?.pages[0]?.total ?? 0;
    const averageRating = reviewsQuery.data?.pages[0]?.averageRating ?? 0;

    const visibleReviews = useMemo(() => {
        if (reviewMode === "all") return fetchedReviews;
        if (reviewMode === "ten") return fetchedReviews.slice(0, 10);
        return fetchedReviews.slice(0, 5);
    }, [fetchedReviews, reviewMode]);

    useEffect(() => {
        const node = reviewsLoadMoreRef.current;
        if (!node) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (
                    reviewMode === "all" &&
                    entries[0].isIntersecting &&
                    reviewsQuery.hasNextPage &&
                    !reviewsQuery.isFetchingNextPage
                ) {
                    reviewsQuery.fetchNextPage();
                }
            },
            { rootMargin: "240px" },
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [reviewMode, reviewsQuery]);

    const openReviewImageViewer = (images: string[], index: number) => {
        if (!images.length) return;
        setViewerImages(images);
        setViewerIndex(index);
        setViewerOpen(true);
    };

    const handleSeeMore = async () => {
        setReviewMode("ten");

        while (fetchedReviews.length < Math.min(10, totalReviews) && reviewsQuery.hasNextPage) {
            // Fetch until we have enough reviews for "See more" view.
            await reviewsQuery.fetchNextPage();
        }
    };

    const handleShowAll = async () => {
        setReviewMode("all");
    };

    const handleReviewSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!reviewCustomerName.trim()) {
            toast({
                title: "Customer name required",
                description: "Please enter your name before submitting.",
                variant: "destructive",
            });
            return;
        }

        if (!reviewComment.trim()) {
            toast({
                title: "Review comment required",
                description: "Please write your review before submitting.",
                variant: "destructive",
            });
            return;
        }

        const formData = new FormData();
        formData.append("productId", String(productId));
        formData.append("customerName", reviewCustomerName.trim());
        formData.append("rating", String(reviewRating));
        formData.append("comment", reviewComment.trim());

        for (const file of [...galleryFiles, ...cameraFiles]) {
            formData.append("images", file);
        }

        await submitReviewMutation.mutateAsync(formData);
    };

    const relatedQuery = useQuery({
        queryKey: ["random-products", productId],
        queryFn: async () => {
            const { data } = await api.get("/product/random-products", {
                params: { limit: 4, excludeId: productId },
            });
            return data.data as Product[];
        },
        enabled: !!productId,
    });

    const related = (relatedQuery.data ?? []).filter((p) => p.stock !== "unavailable");

    if (!Number.isFinite(productId) || productQuery.isError) {
        router.replace("/shop");
        return null;
    }

    const wished = product ? has(product.id) : false;
    const brandName = product?.brand?.name ?? "";
    const sizeInfo =
        activeVariants.length > 0
            ? {
                  isUnstitched: false,
                  sizes: Array.from(new Set(activeVariants.map((variant) => variant.size).filter(Boolean))) as string[],
                  defaultSize: activeVariants[0]?.size || "Standard",
              }
            : getProductSizeInfo(product?.sizes);
    const colors = activeVariants.length > 0
        ? Array.from(
              new Set(
                  activeVariants
                      .filter((variant) => variant.size === size)
                      .map((variant) => variant.color)
                      .filter(Boolean),
              ),
          )
        : product?.colors?.filter(Boolean) ?? [];
    const selectedVariant = activeVariants.find((variant) => {
        const sameSize = variant.size === size;
        const sameColor = colors.length > 0 ? (variant.color || "") === (color || "") : true;
        return sameSize && sameColor;
    });
    const selectedVariantImage = resolveAssetUrl(selectedVariant?.image);
    const variantAware = product ? getVariantAwareProduct(product, selectedVariant) : null;
    const displayGallery = selectedVariantImage
        ? Array.from(new Set([selectedVariantImage, ...gallery]))
        : (variantAware?.displayImages ?? []);
    const displayPrice = variantAware?.displayPrice ?? product?.price ?? 0;
    const displayOldPrice = variantAware?.displayOldPrice ?? null;
    const variantStock = getVariantStock(selectedVariant);
    const isOutOfStock = selectedVariant
        ? variantStock === 0 || selectedVariant.active === false
        : product?.stockQty === 0 || product?.stock === "unavailable";
    const discountPercent = product ? getProductDiscountPercent(product, selectedVariant) : 0;
    const summaryText = product?.productSummary?.trim() ?? "";
    const descriptionLines = product?.description
        ? product.description
              .replace(/\s+/g, " ")
              .trim()
              .split(/(?<=[.!?])\s+/)
              .filter(Boolean)
        : [];

    const handleCheckout = () => {
        if (!product || !size) return;
        addItem({ ...product, price: displayPrice, images: displayGallery }, color ? `${size} / ${color}` : size, qty, true);
        router.push("/checkout");
    };

    if (productQuery.isLoading || !product) {
        return (
            <div className="min-h-screen bg-background">
                <Header />
                <main className="container py-16">
                    <div className="grid lg:grid-cols-[1fr_minmax(360px,420px)] gap-10">
                        <Skeleton className="aspect-[3/4] w-full" />
                        <div className="space-y-4">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-3/4" />
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="h-20 w-full" />
                        </div>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <Header />
            <main className="pb-24">
                {/* Breadcrumb */}
                <div className="container py-5 flex items-center gap-2 text-xs text-muted-foreground">
                    <Link href="/" className="hover:text-primary">
                        Home
                    </Link>
                    <ChevronRight className="h-3 w-3" />
                    <Link href="/shop" className="hover:text-primary">
                        Shop
                    </Link>
                    <ChevronRight className="h-3 w-3" />
                    <span className="text-primary">
                        {[product.category?.name, product.subCategory?.name].filter(Boolean).join(" / ")}
                    </span>
                </div>

                <section className="container grid justify-center gap-8 lg:grid-cols-[minmax(0,720px)_minmax(360px,420px)]">
                    {/* Gallery */}
                    <div className="flex flex-col md:flex-row md:gap-4">
                        {/* Thumbnails grid - left for lg, bottom for mobile */}
                        {gallery.length > 1 && (
                            <div className="order-2 md:order-1 grid grid-cols-5 sm:grid-cols-7 md:grid-cols-1 gap-2 md:w-20 md:h-fit">
                                {displayGallery.map((src, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setActiveImg(i)}
                                        className={cn(
                                            "relative aspect-[3/4] overflow-hidden bg-secondary border-2 transition-all",
                                            activeImg === i
                                                ? "border-primary"
                                                : "border-transparent hover:border-primary/40",
                                        )}
                                    >
                                        <Image
                                            src={src}
                                            alt=""
                                            fill
                                            sizes="80px"
                                            className="absolute inset-0 h-full w-full object-cover"
                                        />
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Main Image */}
                        <div className="order-1 lg:order-2 flex-1">
                            <div className="relative mx-auto max-w-[680px] bg-secondary aspect-[4/5] overflow-hidden">
                                {(discountPercent > 0 || product.badge) && (
                                    <span className="absolute top-4 left-4 z-10 bg-primary text-primary-foreground text-[10px] font-semibold tracking-wider uppercase px-3 py-1.5 rounded-full">
                                        {discountPercent > 0 ? `${discountPercent}% Off` : product.badge}
                                    </span>
                                )}
                                <Image
                                    src={displayGallery[activeImg] ?? displayGallery[0]}
                                    alt={product.name}
                                    fill
                                    priority
                                    sizes="(min-width: 1024px) 60vw, 100vw"
                                    className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
                                />
                                {displayGallery.length > 1 && (
                                    <>
                                        <button
                                            onClick={() =>
                                                setActiveImg((i) => (i - 1 + displayGallery.length) % displayGallery.length)
                                            }
                                            aria-label="Previous image"
                                            className="absolute top-1/2 left-3 -translate-y-1/2 z-10 h-10 w-10 flex items-center justify-center rounded-full bg-background/80 backdrop-blur border border-border hover:bg-background"
                                        >
                                            <ChevronLeft className="h-5 w-5" />
                                        </button>
                                        <button
                                            onClick={() => setActiveImg((i) => (i + 1) % displayGallery.length)}
                                            aria-label="Next image"
                                            className="absolute top-1/2 right-3 -translate-y-1/2 z-10 h-10 w-10 flex items-center justify-center rounded-full bg-background/80 backdrop-blur border border-border hover:bg-background"
                                        >
                                            <ChevronRight className="h-5 w-5" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Info */}
                    <aside className="lg:sticky lg:top-24 lg:self-start space-y-6">
                        <div className="space-y-3">
                            <p className="text-xs uppercase tracking-[0.25em] text-accent font-medium">{brandName}</p>
                            <h1 className="font-serif text-3xl md:text-4xl text-foreground leading-tight">
                                {product.name}
                            </h1>
                            <div className="flex items-baseline gap-3">
                                <span className="text-2xl font-medium text-primary">
                                    BDT {displayPrice.toLocaleString()}
                                </span>
                                {displayOldPrice && displayOldPrice > displayPrice && (
                                    <span className="text-base text-muted-foreground line-through">
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

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-xs uppercase tracking-wider font-medium">Size</p>
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
                                                onClick={() => setSize(s)}
                                                className={cn(
                                                    "h-11 min-w-[44px] px-3 border text-sm font-medium transition-all",
                                                    size === s
                                                        ? "border-primary bg-primary text-primary-foreground"
                                                        : "border-border hover:border-primary",
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
                                <p className="text-xs uppercase tracking-wider font-medium">Color</p>
                                <div className="flex flex-wrap gap-2">
                                    {colors.map((item) => (
                                        <button
                                            key={item}
                                            onClick={() => setColor(item)}
                                            className={cn(
                                                "h-10 min-w-[72px] px-3 border text-sm font-medium transition-all",
                                                color === item
                                                    ? "border-primary bg-primary text-primary-foreground"
                                                    : "border-border hover:border-primary",
                                            )}
                                        >
                                            {item}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            <p className="text-xs uppercase tracking-wider font-medium">Quantity</p>
                            <div className="inline-flex items-center border border-border">
                                <button
                                    disabled={isOutOfStock}
                                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                                    className="h-11 w-11 flex items-center justify-center hover:bg-muted disabled:opacity-50"
                                    aria-label="Decrease"
                                >
                                    <Minus className="h-4 w-4" />
                                </button>
                                <span className="w-12 text-center font-medium tabular-nums">
                                    {isOutOfStock ? 0 : qty}
                                </span>
                                <button
                                    disabled={isOutOfStock}
                                    onClick={() => setQty((q) => q + 1)}
                                    className="h-11 w-11 flex items-center justify-center hover:bg-muted disabled:opacity-50"
                                    aria-label="Increase"
                                >
                                    <Plus className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 pt-2">
                            <div className="flex flex-row gap-3">
                                <Button
                                    size="lg"
                                    disabled={isOutOfStock}
                                    className="flex-1 min-w-0 rounded-none h-12 bg-primary hover:bg-primary-glow"
                                    onClick={() => {
                                        if (!size) return;
                                        addItem({ ...product, price: displayPrice, images: displayGallery }, color ? `${size} / ${color}` : size, qty);
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
                                    aria-label="Wishlist"
                                >
                                    <Heart className={cn("h-4 w-4", wished && "fill-current")} />
                                </Button>
                            </div>
                            <Button
                                size="lg"
                                disabled={isOutOfStock}
                                className="w-full rounded-none h-12 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold uppercase tracking-wider"
                                onClick={handleCheckout}
                            >
                                {isOutOfStock ? "Unavailable" : "Checkout Now"}
                            </Button>
                        </div>

                        {summaryText.length > 0 && (
                            <div className="text-sm text-muted-foreground leading-7 border-t border-border pt-5">
                                <h2 className="mb-2 font-serif text-xl text-foreground">Product Summary</h2>
                                <div className="whitespace-pre-wrap">{summaryText}</div>
                            </div>
                        )}

                        {descriptionLines.length > 0 && (
                            <div className="text-sm text-muted-foreground leading-7 border-t border-border pt-5">
                                <h2 className="mb-2 font-serif text-xl text-foreground">Product Description</h2>
                                {descriptionLines.map((line, index) => (
                                    <p key={`${index}-${line}`}>{line}</p>
                                ))}
                            </div>
                        )}

                        <div className="border-t border-border pt-5 grid grid-cols-2 gap-3 text-xs">
                            {[
                                { i: Truck, t: "Free shipping >5k" },
                                { i: ShieldCheck, t: "Secure checkout" },
                            ].map(({ i: Icon, t }) => (
                                <div
                                    key={t}
                                    className="flex flex-col items-center text-center gap-1.5 text-muted-foreground"
                                >
                                    <Icon className="h-4 w-4 text-primary" />
                                    <span>{t}</span>
                                </div>
                            ))}
                        </div>
                    </aside>
                </section>

                <section className="container mt-16 lg:mt-20 space-y-8">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center justify-center gap-2">
                                <h3 className="font-serif text-lg sm:text-2xl text-foreground">Customer Reviews</h3>
                                <div className="text-sm sm:text-lg font-semibold text-primary mt-1">
                                    ({averageRating > 0 ? averageRating.toFixed(1) : "0.0"} / 5.0)
                                </div>
                            </div>

                            {totalReviews > 0 && (
                                <Button
                                    variant="ghost"
                                    className="h-8 px-2 text-xs sm:text-sm"
                                    onClick={handleShowAll}
                                    disabled={reviewMode === "all" || reviewsQuery.isFetchingNextPage}
                                >
                                    Show all ({totalReviews})
                                </Button>
                            )}
                        </div>

                        {reviewsQuery.isLoading ? (
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <Skeleton key={i} className="h-44 w-full" />
                                ))}
                            </div>
                        ) : visibleReviews.length === 0 ? (
                            <div className="border border-border p-6 text-sm text-muted-foreground">
                                No reviews yet. Be the first to add one.
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {visibleReviews.map((review) => (
                                        <article key={review.id} className="border border-border bg-card p-4 space-y-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h4 className="font-medium text-foreground">
                                                        {review.customerName}
                                                    </h4>
                                                    <p className="text-xs text-muted-foreground">
                                                        {new Date(review.createdAt).toLocaleString("en-US", {
                                                            hour: "numeric",
                                                            minute: "2-digit",
                                                            hour12: true,
                                                            month: "numeric",
                                                            day: "numeric",
                                                            year: "numeric",
                                                        })}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-0.5">
                                                    {Array.from({ length: 5 }).map((_, i) => (
                                                        <Star
                                                            key={i}
                                                            className={cn(
                                                                "h-3.5 w-3.5",
                                                                i < review.rating
                                                                    ? "fill-primary text-primary"
                                                                    : "text-muted-foreground/30",
                                                            )}
                                                        />
                                                    ))}
                                                </div>
                                            </div>

                                            <p className="text-sm leading-relaxed text-muted-foreground md:line-clamp-4">
                                                {review.comment}
                                            </p>

                                            {review.images.length > 0 && (
                                                <div className="grid grid-cols-3 lg:grid-cols-4 gap-2">
                                                    {review.images.slice(0, 8).map((image, idx) => (
                                                        <button
                                                            key={`${review.id}-${idx}`}
                                                            type="button"
                                                            onClick={() => openReviewImageViewer(review.images, idx)}
                                                            className="relative aspect-square overflow-hidden rounded-md border border-border"
                                                        >
                                                            <Image
                                                                src={image}
                                                                alt="Review image"
                                                                fill
                                                                sizes="(min-width: 1024px) 10vw, 25vw"
                                                                className="h-full w-full object-cover"
                                                            />
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </article>
                                    ))}
                                </div>

                                {reviewMode === "initial" && totalReviews > 5 && (
                                    <div className="pt-2">
                                        <Button
                                            variant="outline"
                                            className="h-10 rounded-none"
                                            onClick={handleSeeMore}
                                            disabled={reviewsQuery.isFetchingNextPage}
                                        >
                                            {reviewsQuery.isFetchingNextPage && (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            )}
                                            See more
                                        </Button>
                                    </div>
                                )}

                                {reviewMode === "all" && reviewsQuery.isFetchingNextPage && (
                                    <div className="pt-2 text-sm text-muted-foreground flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading all reviews...
                                    </div>
                                )}

                                {reviewMode === "all" && <div ref={reviewsLoadMoreRef} className="h-1 w-full" />}
                            </>
                        )}
                    </div>
                    <div className="border border-border bg-card p-5 sm:p-6 lg:p-7">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h2 className="font-serif text-2xl md:text-3xl text-foreground">Review</h2>
                            <Button
                                type="button"
                                variant={reviewFormOpen ? "secondary" : "default"}
                                className="h-10 rounded-none"
                                onClick={() => setReviewFormOpen((open) => !open)}
                            >
                                {reviewFormOpen ? "Hide Review Form" : "Write a Review"}
                            </Button>
                        </div>

                        {reviewFormOpen && (
                        <form onSubmit={handleReviewSubmit} className="mt-5 space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="review-customer-name">Customer Name</Label>
                                    <Input
                                        id="review-customer-name"
                                        value={reviewCustomerName}
                                        onChange={(e) => setReviewCustomerName(e.target.value)}
                                        placeholder="Enter your name"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Rating</Label>
                                    <div className="flex items-center gap-1.5">
                                        {Array.from({ length: 5 }).map((_, i) => {
                                            const value = i + 1;
                                            const active = value <= reviewRating;

                                            return (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    onClick={() => setReviewRating(value)}
                                                    className="p-1 transition-colors hover:bg-secondary"
                                                    aria-label={`Set rating ${value}`}
                                                >
                                                    <Star
                                                        className={cn(
                                                            "h-5 w-5",
                                                            active
                                                                ? "fill-primary text-primary"
                                                                : "text-muted-foreground/40",
                                                        )}
                                                    />
                                                </button>
                                            );
                                        })}
                                        <span className="ml-1 text-sm text-muted-foreground">{reviewRating} / 5</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="review-comment">Review Comment</Label>
                                    <Textarea
                                        id="review-comment"
                                        value={reviewComment}
                                        onChange={(e) => setReviewComment(e.target.value)}
                                        placeholder="Share your experience with this product"
                                        className="min-h-[120px]"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="review-gallery">Add From Gallery (optional)</Label>
                                    <div className="border border-dashed border-border bg-background p-3">
                                        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                                            <ImagePlus className="h-4 w-4" />
                                            <span>Choose one or multiple images</span>
                                        </div>
                                        <Input
                                            id="review-gallery"
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={(e) => setGalleryFiles(Array.from(e.target.files ?? []))}
                                        />
                                    </div>
                                </div>
                            </div>

                            {(galleryFiles.length > 0 || cameraFiles.length > 0) && (
                                <div className="text-xs text-muted-foreground">
                                    Selected images: {galleryFiles.length + cameraFiles.length}
                                </div>
                            )}

                            <Button
                                type="submit"
                                className="h-11 rounded-none"
                                disabled={submitReviewMutation.isPending}
                            >
                                {submitReviewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Submit Review
                            </Button>
                        </form>
                        )}
                    </div>
                </section>

                {/* Related */}
                {related.length > 0 && (
                    <section className="container mt-24">
                        <div className="flex items-end justify-between mb-8">
                            <div>
                                <p className="text-xs tracking-[0.3em] uppercase text-accent mb-2">You may also like</p>
                                <h2 className="font-serif text-3xl md:text-4xl text-foreground">Related products</h2>
                            </div>
                            <Link href="/shop" className="text-sm story-link hidden md:inline">
                                View all
                            </Link>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
                            {related.map((p, i) => (
                                <ProductCard key={p.id} product={p} index={i} />
                            ))}
                        </div>
                    </section>
                )}
            </main>

            <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
                <DialogContent className="max-w-3xl p-3 sm:p-4">
                    <DialogHeader>
                        <DialogTitle>Review image</DialogTitle>
                        <DialogDescription className="sr-only">Enlarged review image preview.</DialogDescription>
                    </DialogHeader>

                    {viewerImages.length > 0 && (
                        <div className="relative w-full h-[70vh]">
                            <Image
                                src={viewerImages[viewerIndex]}
                                alt="Large review preview"
                                fill
                                sizes="90vw"
                                className="rounded-md object-contain"
                            />

                            {viewerImages.length > 1 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setViewerIndex((i) => (i - 1 + viewerImages.length) % viewerImages.length)
                                        }
                                        className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/90 border border-border flex items-center justify-center"
                                        aria-label="Previous review image"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setViewerIndex((i) => (i + 1) % viewerImages.length)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/90 border border-border flex items-center justify-center"
                                        aria-label="Next review image"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Footer />
        </div>
    );
}
