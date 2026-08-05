import { useEffect, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Eye,
  Loader2,
  Search,
  Star,
  Trash2,
} from "lucide-react";

import { api } from "@/lib/api";
import { useDebounce } from "@/hooks/use-debounce";
import { useGlobalStats } from "@/contexts/GlobalStatsContext";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ReviewProduct {
  id: number;
  name: string;
  images: string[];
}

type ReviewStatus = "PENDING" | "APPROVED" | "CANCELLED";

interface ReviewRow {
  id: number;
  customerName: string;
  rating: number;
  comment: string;
  images: string[];
  status: ReviewStatus;
  createdAt: string;
  product: ReviewProduct | null;
}

interface ReviewListPayload {
  reviews: ReviewRow[];
  total: number;
  page: number;
  limit: number;
}

const statusStyles: Record<ReviewStatus, string> = {
  APPROVED:
    "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400",
  PENDING:
    "border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  CANCELLED: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
};

const allStatuses: ReviewStatus[] = ["PENDING", "APPROVED", "CANCELLED"];

function formatStatus(value: ReviewStatus) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export default function ReviewsPage() {
  const queryClient = useQueryClient();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const { totalReviews } = useGlobalStats();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ReviewStatus>("ALL");
  const [selectedReview, setSelectedReview] = useState<ReviewRow | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<ReviewStatus>("PENDING");

  const debouncedSearch = useDebounce(search, 400);

  const reviewsQuery = useInfiniteQuery({
    queryKey: ["admin-reviews", debouncedSearch, statusFilter],
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get("/review/admin/all-reviews", {
        params: {
          page: pageParam,
          limit: 10,
          search: debouncedSearch || undefined,
          status: statusFilter === "ALL" ? undefined : statusFilter,
        },
      });

      return data.data as ReviewListPayload;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const nextPage = lastPage.page + 1;
      return lastPage.page * lastPage.limit < lastPage.total
        ? nextPage
        : undefined;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: number;
      status: ReviewStatus;
    }) => {
      const { data } = await api.patch(`/review/admin/update-status/${id}`, {
        status,
      });
      return data;
    },
    onSuccess: async () => {
      toast({ title: "Review status updated" });
      setSelectedReview(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error) || "Failed to update review status";

      toast({
        title: "Update failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const deleteReviewMutation = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.delete(`/review/admin/delete/${id}`);
      return data;
    },
    onSuccess: async () => {
      toast({ title: "Review deleted" });
      setSelectedReview(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error) || "Failed to delete review";

      toast({
        title: "Delete failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const reviews = useMemo(
    () => reviewsQuery.data?.pages.flatMap((p) => p.reviews) ?? [],
    [reviewsQuery.data],
  );

  useEffect(() => {
    if (!selectedReview) return;
    setSelectedStatus(selectedReview.status);
  }, [selectedReview]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          reviewsQuery.hasNextPage &&
          !reviewsQuery.isFetchingNextPage
        ) {
          reviewsQuery.fetchNextPage();
        }
      },
      { rootMargin: "220px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [reviewsQuery]);

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-3 p-4 shadow-soft md:flex-row md:items-center md:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by customer, product, comment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 rounded-xl pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as "ALL" | ReviewStatus)
            }
          >
            <SelectTrigger className="h-10 w-[120px] rounded-xl">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              {allStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {formatStatus(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <Table className="min-w-[900px] text-nowrap">
            <TableHeader>
              <TableRow className="bg-secondary/40">
                <TableHead className="w-14 text-center">#</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviewsQuery.isLoading &&
                reviews.length === 0 &&
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    <TableCell className="text-center">
                      <Skeleton className="mx-auto h-4 w-6" />
                    </TableCell>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={`cell-${j}`}>
                        <Skeleton className="h-4 w-3/4" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {reviews.map((review, idx) => (
                <TableRow key={review.id} className="hover:bg-secondary/30">
                  <TableCell className="text-center text-muted-foreground text-sm">
                    {idx + 1}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-secondary aspect-square">
                        {review.product?.images?.[0] ? (
                          <img
                            src={review.product.images[0]}
                            alt={review.product?.name || "Product"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                            N/A
                          </div>
                        )}
                      </div>
                      <span className="font-medium">
                        {review.product?.name || "Unknown product"}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>{review.customerName}</TableCell>

                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${
                            i < review.rating
                              ? "fill-primary text-primary"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      ))}
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="block max-w-[260px] truncate text-sm text-muted-foreground">
                      {review.comment}
                    </span>
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusStyles[review.status]}
                    >
                      {formatStatus(review.status)}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    {new Date(review.createdAt).toLocaleDateString()}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setSelectedReview(review)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteReviewMutation.mutate(review.id)}
                        disabled={deleteReviewMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {!reviewsQuery.isLoading && reviews.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-12 text-center text-muted-foreground"
                  >
                    No reviews found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div ref={loadMoreRef} className="h-10 flex items-center justify-center">
        {reviewsQuery.isFetchingNextPage && (
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading more reviews...
          </div>
        )}
      </div>

      <Dialog
        open={!!selectedReview}
        onOpenChange={(open) => !open && setSelectedReview(null)}
      >
        <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Review details
            </DialogTitle>
          </DialogHeader>

          {selectedReview && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Customer
                  </div>
                  <div className="font-medium text-foreground">
                    {selectedReview.customerName}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Review Date
                  </div>
                  <div className="text-foreground">
                    {new Date(selectedReview.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Product
                  </div>
                  <div className="text-foreground">
                    {selectedReview.product?.name || "Unknown product"}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Rating
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < selectedReview.rating
                            ? "fill-primary text-primary"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Comment
                </div>
                <div className="rounded-xl bg-secondary/50 p-4 text-sm leading-relaxed text-foreground">
                  {selectedReview.comment}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Status
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Select
                      value={selectedStatus}
                      onValueChange={(value) =>
                        setSelectedStatus(value as ReviewStatus)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {allStatuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {formatStatus(status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={() =>
                      updateStatusMutation.mutate({
                        id: selectedReview.id,
                        status: selectedStatus,
                      })
                    }
                    disabled={
                      updateStatusMutation.isPending ||
                      selectedStatus === selectedReview.status
                    }
                    className="h-10 px-4"
                  >
                    {updateStatusMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {updateStatusMutation.isPending ? "Updating..." : "Update status"}
                  </Button>
                </div>
              </div>

              {selectedReview.images.length > 0 && (
                <div className="border-t border-border pt-4">
                  <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Review images ({selectedReview.images.length})
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
                    {selectedReview.images.map((img, index) => (
                      <a
                        key={`${selectedReview.id}-${index}`}
                        href={img}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-lg border border-border bg-secondary hover:opacity-80 transition-opacity aspect-square"
                      >
                        <img
                          src={img}
                          alt={`Review image ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
