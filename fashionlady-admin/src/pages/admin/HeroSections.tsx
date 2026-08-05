import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, Pencil, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { api, resolveAssetUrl } from "@/lib/api";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { HeroSection } from "@/types/store";

interface HeroSectionListPayload {
    heroSections: HeroSection[];
    total: number;
    page: number;
    limit: number;
}

const statusOptions = [
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
];

const statusStyles: Record<string, string> = {
    active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    inactive: "border-muted-foreground/20 bg-muted text-muted-foreground",
};

export default function HeroSections() {
    const queryClient = useQueryClient();
    const loadMoreRef = useRef<HTMLDivElement | null>(null);
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 400);
    const [editingHero, setEditingHero] = useState<HeroSection | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [deletingHero, setDeletingHero] = useState<HeroSection | null>(null);

    const heroSectionsQuery = useInfiniteQuery({
        queryKey: ["admin-hero-sections", debouncedSearch],
        queryFn: async ({ pageParam = 1 }) => {
            const { data } = await api.get("/dashboard/hero-sections/admin", {
                params: {
                    page: pageParam,
                    limit: 8,
                    search: debouncedSearch || undefined,
                },
            });

            return data.data as HeroSectionListPayload;
        },
        initialPageParam: 1,
        getNextPageParam: (lastPage) => {
            const nextPage = lastPage.page + 1;
            return lastPage.page * lastPage.limit < lastPage.total ? nextPage : undefined;
        },
    });

    const heroSections = heroSectionsQuery.data?.pages.flatMap((page) => page.heroSections) ?? [];

    useEffect(() => {
        const node = loadMoreRef.current;
        if (!node) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (
                    entries[0].isIntersecting &&
                    heroSectionsQuery.hasNextPage &&
                    !heroSectionsQuery.isFetchingNextPage
                ) {
                    heroSectionsQuery.fetchNextPage();
                }
            },
            { rootMargin: "200px" },
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [heroSectionsQuery]);

    const createMutation = useMutation({
        mutationFn: async (payload: FormData) => {
            const { data } = await api.post("/dashboard/hero-sections", payload, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            return data.data as HeroSection;
        },
        onSuccess: async () => {
            toast({ title: "Hero section created" });
            setFormOpen(false);
            setEditingHero(null);
            await queryClient.invalidateQueries({ queryKey: ["admin-hero-sections"] });
        },
        onError: (error: unknown) => {
            toast({
                title: "Create failed",
                description: getErrorMessage(error) || "Failed to create hero section.",
                variant: "destructive",
            });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, payload }: { id: number; payload: FormData }) => {
            const { data } = await api.patch(`/dashboard/hero-sections/${id}`, payload, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            return data.data as HeroSection;
        },
        onSuccess: async () => {
            toast({ title: "Hero section updated" });
            setFormOpen(false);
            setEditingHero(null);
            await queryClient.invalidateQueries({ queryKey: ["admin-hero-sections"] });
        },
        onError: (error: unknown) => {
            toast({
                title: "Update failed",
                description: getErrorMessage(error) || "Failed to update hero section.",
                variant: "destructive",
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const { data } = await api.delete(`/dashboard/hero-sections/${id}`);
            return data.data;
        },
        onSuccess: async () => {
            toast({ title: "Hero section deleted" });
            setDeletingHero(null);
            await queryClient.invalidateQueries({ queryKey: ["admin-hero-sections"] });
        },
        onError: (error: unknown) => {
            toast({
                title: "Delete failed",
                description: getErrorMessage(error) || "Failed to delete hero section.",
                variant: "destructive",
            });
        },
    });

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        if (editingHero) {
            await updateMutation.mutateAsync({ id: editingHero.id, payload: formData });
        } else {
            await createMutation.mutateAsync(formData);
        }
    };

    const isSaving = createMutation.isPending || updateMutation.isPending;

    return (
        <div className="space-y-6">
            <Card className="flex flex-col gap-3 p-4 shadow-soft md:flex-row md:items-center md:justify-between">
                <div className="relative max-w-sm flex-1">
                    <ImageIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search hero sections..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-10 rounded-xl pl-9"
                    />
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => heroSectionsQuery.refetch()} variant="outline" className="h-10 rounded-xl">
                        <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                    </Button>
                    <Button
                        onClick={() => {
                            setEditingHero(null);
                            setFormOpen(true);
                        }}
                        className="h-10 rounded-xl bg-gradient-primary text-primary-foreground"
                    >
                        <Plus className="mr-2 h-4 w-4" /> Add Hero Section
                    </Button>
                </div>
            </Card>

            {heroSectionsQuery.isLoading && heroSections.length === 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} className="h-[360px] w-full rounded-3xl" />
                    ))}
                </div>
            ) : heroSections.length === 0 ? (
                <Card className="p-10 text-center text-muted-foreground shadow-soft">No hero sections found.</Card>
            ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                    {heroSections.map((hero) => (
                        <Card key={hero.id} className="overflow-hidden shadow-soft">
                            <div className="grid gap-0 lg:grid-cols-[1.3fr_1fr]">
                                <div className="relative min-h-[260px] overflow-hidden bg-secondary">
                                    <img
                                        src={resolveAssetUrl(hero.image)}
                                        alt={hero.title}
                                        className="h-full w-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-tr from-black/55 via-black/20 to-transparent" />
                                    <div className="absolute inset-0 flex items-end p-6 text-white">
                                        <div className="max-w-md space-y-2">
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70">
                                                Desktop Hero
                                            </p>
                                            <h3 className="font-display text-3xl font-semibold leading-tight">
                                                {hero.title}
                                            </h3>
                                            <p className="text-sm text-white/85">{hero.subtitle}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-4 p-5">
                                    <div className="flex items-center justify-between gap-3">
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "rounded-full px-3 py-1 text-[10px] uppercase tracking-wider",
                                                statusStyles[hero.status] || "",
                                            )}
                                        >
                                            {hero.status}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">Order #{hero.order}</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2 rounded-2xl border bg-secondary/30 p-3">
                                            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                                                Mobile
                                            </p>
                                            <img
                                                src={resolveAssetUrl(hero.mobileImage)}
                                                alt={`${hero.title} mobile`}
                                                className="aspect-[3/4] w-full rounded-xl object-cover"
                                            />
                                        </div>
                                        <div className="space-y-3 rounded-2xl border bg-secondary/30 p-3 text-sm">
                                            <div>
                                                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                                                    Button
                                                </div>
                                                <div className="font-medium">{hero.buttonText}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                                                    Link
                                                </div>
                                                <div className="break-all text-muted-foreground">{hero.buttonUrl}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 pt-1">
                                        <Button
                                            variant="outline"
                                            className="rounded-xl"
                                            onClick={() => {
                                                setEditingHero(hero);
                                                setFormOpen(true);
                                            }}
                                        >
                                            <Pencil className="mr-2 h-4 w-4" /> Edit
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                            onClick={() => setDeletingHero(hero)}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <div ref={loadMoreRef} className="h-8" />

            <Dialog open={formOpen} onOpenChange={(open) => !open && setFormOpen(false)}>
                <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="font-display text-2xl">
                            {editingHero ? "Edit Hero Section" : "Create Hero Section"}
                        </DialogTitle>
                    </DialogHeader>

                    <form key={editingHero?.id ?? "create"} onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5 sm:col-span-2">
                                <Label htmlFor="title">Title</Label>
                                <Input id="title" name="title" defaultValue={editingHero?.title ?? ""} required />
                            </div>
                            <div className="space-y-1.5 sm:col-span-2">
                                <Label htmlFor="subtitle">Subtitle</Label>
                                <Textarea
                                    id="subtitle"
                                    name="subtitle"
                                    defaultValue={editingHero?.subtitle ?? ""}
                                    required
                                    className="min-h-28"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="buttonText">Button Text</Label>
                                <Input
                                    id="buttonText"
                                    name="buttonText"
                                    defaultValue={editingHero?.buttonText ?? ""}
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="buttonUrl">Button Link</Label>
                                <Input
                                    id="buttonUrl"
                                    name="buttonUrl"
                                    defaultValue={editingHero?.buttonUrl ?? "/shop"}
                                    placeholder="/shop"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="order">Order</Label>
                                <Input
                                    id="order"
                                    name="order"
                                    type="number"
                                    min="0"
                                    defaultValue={editingHero?.order ?? 0}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="status">Status</Label>
                                <select
                                    id="status"
                                    name="status"
                                    defaultValue={editingHero?.status ?? "active"}
                                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    {statusOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5 sm:col-span-2">
                                <Label htmlFor="image">
                                    Desktop Image {editingHero ? "(leave empty to keep current)" : ""}
                                </Label>
                                {editingHero?.image && (
                                    <div className="mb-2 overflow-hidden rounded-2xl border bg-secondary/30">
                                        <img
                                            src={resolveAssetUrl(editingHero.image)}
                                            alt={editingHero.title}
                                            className="h-44 w-full object-cover"
                                        />
                                    </div>
                                )}
                                <Input id="image" name="image" type="file" accept="image/*" required={!editingHero} />
                            </div>
                            <div className="space-y-1.5 sm:col-span-2">
                                <Label htmlFor="mobileImage">
                                    Mobile Image {editingHero ? "(leave empty to keep current)" : ""}
                                </Label>
                                {editingHero?.mobileImage && (
                                    <div className="mb-2 overflow-hidden rounded-2xl border bg-secondary/30 max-w-[220px]">
                                        <img
                                            src={resolveAssetUrl(editingHero.mobileImage)}
                                            alt={`${editingHero.title} mobile`}
                                            className="h-56 w-full object-cover"
                                        />
                                    </div>
                                )}
                                <Input
                                    id="mobileImage"
                                    name="mobileImage"
                                    type="file"
                                    accept="image/*"
                                    required={!editingHero}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                className="bg-gradient-primary text-primary-foreground"
                                disabled={isSaving}
                            >
                                {isSaving ? "Saving..." : editingHero ? "Update Hero" : "Create Hero"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!deletingHero} onOpenChange={(open) => !open && setDeletingHero(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete hero section?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        This will remove the hero content and delete the uploaded desktop and mobile images.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeletingHero(null)}>
                            Cancel
                        </Button>
                        <Button
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deletingHero && deleteMutation.mutate(deletingHero.id)}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
