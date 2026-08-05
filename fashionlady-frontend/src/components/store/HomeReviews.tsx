"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, MessageSquareQuote, Star, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

type ReviewProduct = {
  id: number;
  name: string;
  images: string[];
};

type HomeReview = {
  id: number;
  customerName: string;
  rating: number;
  comment: string;
  images: string[];
  createdAt: string;
  product: ReviewProduct | null;
};

type ReviewResponse = {
  reviews: HomeReview[];
  total: number;
  page: number;
  limit: number;
};

export const HomeReviews = () => {
  const [expanded, setExpanded] = useState(false);

  // Lightbox state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  const reviewsQuery = useQuery({
    queryKey: ["home-reviews"],
    queryFn: async () => {
      const { data } = await api.get("/review/recent", {
        params: { limit: 20 },
      });
      return data.data as ReviewResponse;
    },
    staleTime: 5 * 60 * 1000,
  });

  const reviews = useMemo(
    () => reviewsQuery.data?.reviews ?? [],
    [reviewsQuery.data?.reviews],
  );
  const visibleReviews = useMemo(
    () => reviews.slice(0, expanded ? 20 : 8),
    [expanded, reviews],
  );

  const openViewer = useCallback((images: string[], index: number) => {
    setViewerImages(images);
    setViewerIndex(index);
    setViewerOpen(true);
  }, []);

  const closeViewer = useCallback(() => {
    setViewerOpen(false);
  }, []);

  return (
    <>
      <section className="py-12 lg:py-20 bg-secondary/20">
        <div className="container space-y-8">
          {/* Header */}
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-accent">
                Recent reviews
              </p>
              <h2 className="font-serif text-3xl md:text-5xl text-primary">
                What customers are saying
              </h2>
              <p className="text-muted-foreground">
                Real photos &amp; feedback from verified buyers — see what&apos;s arriving right now.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="rounded-none border-primary"
              onClick={() => setExpanded((value) => !value)}
              disabled={reviewsQuery.isLoading || reviews.length === 0}
            >
              {expanded ? "Show less" : "See more reviews"}
            </Button>
          </div>

          {/* Skeleton loader */}
          {reviewsQuery.isLoading && (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="border border-border bg-background p-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-16 w-full" />
                  <div className="grid grid-cols-3 gap-2">
                    <Skeleton className="aspect-square" />
                    <Skeleton className="aspect-square" />
                    <Skeleton className="aspect-square" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!reviewsQuery.isLoading && visibleReviews.length === 0 && (
            <div className="rounded-none border border-dashed border-border bg-background p-10 text-center text-muted-foreground">
              No recent reviews are available yet.
            </div>
          )}

          {/* Review Cards */}
          {visibleReviews.length > 0 && (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleReviews.map((review, index) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  index={index}
                  onImageClick={openViewer}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Lightbox Viewer */}
      {viewerOpen && viewerImages.length > 0 && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={closeViewer}
        >
          <button
            type="button"
            onClick={closeViewer}
            className="absolute top-4 right-4 z-[110] h-10 w-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            aria-label="Close viewer"
          >
            <X className="h-5 w-5" />
          </button>

          <div
            className="relative max-w-4xl w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[3/4] sm:aspect-[4/3] w-full overflow-hidden rounded-lg">
              <Image
                src={viewerImages[viewerIndex]}
                alt="Review image"
                fill
                sizes="(max-width: 768px) 100vw, 80vw"
                className="object-contain"
              />
            </div>

            {viewerImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setViewerIndex(
                      (i) =>
                        (i - 1 + viewerImages.length) % viewerImages.length,
                    )
                  }
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 border border-white/20 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setViewerIndex((i) => (i + 1) % viewerImages.length)
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 border border-white/20 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>

                {/* Dot indicators */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                  {viewerImages.map((_, dotIdx) => (
                    <button
                      key={dotIdx}
                      type="button"
                      onClick={() => setViewerIndex(dotIdx)}
                      className={`h-2 rounded-full transition-all ${
                        dotIdx === viewerIndex
                          ? "w-6 bg-white"
                          : "w-2 bg-white/40 hover:bg-white/60"
                      }`}
                      aria-label={`Go to image ${dotIdx + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

/* ──────────────── Individual Review Card ──────────────── */

function ReviewCard({
  review,
  index,
  onImageClick,
}: {
  review: HomeReview;
  index: number;
  onImageClick: (images: string[], index: number) => void;
}) {
  const hasImages = review.images.length > 0;

  return (
    <article
      className="group relative flex flex-col border border-border/80 bg-background shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md overflow-hidden"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      {/* Top section: customer info + rating */}
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="min-w-0">
          <h3 className="font-medium text-primary truncate">
            {review.customerName}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(review.createdAt).toLocaleDateString("en-BD", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {Array.from({ length: 5 }).map((_, starIndex) => (
            <Star
              key={starIndex}
              className={`h-3.5 w-3.5 ${
                starIndex < review.rating
                  ? "fill-primary text-primary"
                  : "text-muted-foreground/25"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Comment */}
      <div className="px-4 pb-3">
        <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3">
          {review.comment}
        </p>
      </div>

      {/* Review Images Grid */}
      {hasImages ? (
        <div className="px-4 pb-4">
          <div
            className={`grid gap-1.5 ${
              review.images.length === 1
                ? "grid-cols-1"
                : review.images.length === 2
                  ? "grid-cols-2"
                  : "grid-cols-3"
            }`}
          >
            {review.images.slice(0, 6).map((image, idx) => (
              <button
                key={`${review.id}-img-${idx}`}
                type="button"
                onClick={() => onImageClick(review.images, idx)}
                className="relative aspect-square overflow-hidden rounded-sm border border-border/60 bg-secondary group/img"
              >
                <Image
                  src={image}
                  alt={`Review photo ${idx + 1}`}
                  fill
                  sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 16vw"
                  className="object-cover transition-transform duration-500 group-hover/img:scale-110"
                />
                {/* Overlay on last visible image if there are more */}
                {idx === 5 && review.images.length > 6 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white text-sm font-semibold">
                      +{review.images.length - 6}
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* No review images — show a subtle quote icon background */
        <div className="px-4 pb-4 flex-1 flex items-end">
          <div className="w-full rounded-sm bg-secondary/60 p-3 flex items-center gap-2.5">
            <MessageSquareQuote className="h-5 w-5 text-primary/30 flex-shrink-0" />
            <p className="text-xs text-muted-foreground italic line-clamp-2">
              &ldquo;{review.comment}&rdquo;
            </p>
          </div>
        </div>
      )}

      {/* Product link footer */}
      {review.product?.id && (
        <div className="border-t border-border/60 px-4 py-2.5 mt-auto">
          <Link
            href={`/product/${review.product.id}`}
            className="flex items-center justify-between text-xs group/link"
          >
            <span className="text-muted-foreground truncate max-w-[70%]">
              {review.product.name}
            </span>
            <span className="text-primary font-medium group-hover/link:underline flex-shrink-0">
              View product →
            </span>
          </Link>
        </div>
      )}
    </article>
  );
}