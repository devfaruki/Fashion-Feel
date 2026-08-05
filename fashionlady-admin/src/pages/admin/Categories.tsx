import { useEffect, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { CrudTable } from "@/components/admin/CrudTable";
import { api, resolveAssetUrl } from "@/lib/api";
import { getFileObjects } from "@/lib/file-utils";
import type { Category } from "@/types/store";
import { useDebounce } from "@/hooks/use-debounce";
import { Switch } from "@/components/ui/switch";
import { cn, getErrorMessage } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type CategoryRow = Category;

export default function Categories() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const categoriesQuery = useInfiniteQuery({
    queryKey: ["admin-categories", debouncedSearch],
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get("/category/all-categories", {
        params: { page: pageParam, limit: 10, search: debouncedSearch },
      });
      return data.data as {
        categories: CategoryRow[];
        total: number;
        page: number;
        limit: number;
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const nextPage = lastPage.page + 1;
      return lastPage.page * lastPage.limit < lastPage.total
        ? nextPage
        : undefined;
    },
  });

  const categories =
    categoriesQuery.data?.pages.flatMap((p) => p.categories) ?? [];

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          categoriesQuery.hasNextPage &&
          !categoriesQuery.isFetchingNextPage
        ) {
          categoriesQuery.fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [categoriesQuery]);

  const createMutation = useMutation({
    mutationFn: async (payload: FormData | Partial<CategoryRow>) => {
      const isFormData = payload instanceof FormData;
      const { data } = await api.post("/category/add-category", payload, 
        isFormData
          ? { headers: { "Content-Type": "multipart/form-data" } }
          : undefined,
      );
      return data.data as CategoryRow;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: number;
      payload: FormData | Partial<CategoryRow>;
    }) => {
      const isFormData = payload instanceof FormData;
      const { data } = await api.patch(
        `/category/update-category/${id}`,
        payload,
        isFormData
          ? { headers: { "Content-Type": "multipart/form-data" } }
          : undefined,
      );
      return data.data as CategoryRow;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.delete(`/category/delete-category/${id}`);
      return data.data as CategoryRow;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] }),
  });

  return (
    <div className="space-y-6 text-nowrap">
      <CrudTable<CategoryRow>
        entityName="Category"
        initialRows={[]}
        rows={categories}
        isLoading={categoriesQuery.isLoading}
        disableLocalFilter
        onSearchChange={setSearch}
        searchKeys={["name"]}
        newRow={() => ({})}
        fields={[
          { key: "name", label: "Name" },
          { key: "image", label: "Image", type: "file" },
          {
            key: "status",
            label: "Status",
            type: "select",
            options: [
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
            ],
          },
        ]}
        columns={[
          {
            key: "name",
            label: "Category",
            render: (c) => (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 overflow-hidden rounded-xl bg-secondary">
                  {c.image && (
                    <img
                      src={resolveAssetUrl(c.image)}
                      alt={c.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="leading-tight">
                  <div className="font-medium">{c.name}</div>
                  <div
                    className={cn(
                      "text-[9px] font-bold uppercase tracking-wider",
                      c.status === "active"
                        ? "text-emerald-500"
                        : "text-red-500",
                    )}
                  >
                    {c.status === "active" ? "Active" : "Inactive"}
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: "_count",
            label: "Products",
            align: "right",
            render: (c) => c._count?.products ?? 0,
          },
          {
            key: "status",
            label: "Active",
            render: (c) => (
              <div className="flex items-center gap-3">
                <Switch
                  checked={c.status === "active"}
                  onCheckedChange={async (checked) => {
                    try {
                      const newStatus = checked ? "active" : "inactive";
                      await updateMutation.mutateAsync({
                        id: c.id,
                        payload: { status: newStatus },
                      });
                      toast({
                        title: "Status Updated",
                        description: `Category is now ${newStatus}.`,
                      });
                    } catch (error: unknown) {
                      const message = getErrorMessage(error) || "Failed to update status";
                      toast({
                        title: "Update Failed",
                        description: message,
                        variant: "destructive",
                      });
                    }
                  }}
                />
              </div>
            ),
          },
        ]}
        renderDetails={(c) => (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 overflow-hidden rounded-xl bg-secondary">
                {c.image && (
                  <img
                    src={resolveAssetUrl(c.image)}
                    alt={c.name}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">
                  Name
                </div>
                <div className="font-medium">{c.name}</div>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">
                Products
              </div>
              <div>{c._count?.products ?? 0}</div>
            </div>
          </div>
        )}
        onCreate={async (data) => {
          const files = getFileObjects(
            data.image as unknown as FileList | null,
          );

          if (files.length > 0) {
            // Use FormData for file upload
            const formData = new FormData();
            formData.append("name", String(data.name || ""));
            formData.append("status", data.status ? String(data.status) : "active");
            formData.append("image", files[0]);
            await createMutation.mutateAsync(formData);
          } else {
            // No image — send plain JSON
            await createMutation.mutateAsync({
              name: String(data.name || ""),
              image: null,
              status: data.status ? String(data.status) : "active",
            });
          }
        }}
        onUpdate={async (row, data) => {
          const files = getFileObjects(
            data.image as unknown as FileList | null,
          );
          const shouldRemoveImage = Boolean(
            (data as Record<string, unknown>).imageRemove,
          );

          if (files.length > 0) {
            // Use FormData for file upload
            const formData = new FormData();
            formData.append("name", data.name ? String(data.name) : row.name);
            formData.append("status", data.status ? String(data.status) : row.status);
            formData.append("image", files[0]);
            await updateMutation.mutateAsync({ id: row.id, payload: formData });
          } else {
            // No new image — send plain JSON
            const payload: Partial<CategoryRow> = {
              name: data.name ? String(data.name) : row.name,
              status: data.status ? String(data.status) : row.status,
            };

            if (shouldRemoveImage) payload.image = null;

            await updateMutation.mutateAsync({ id: row.id, payload });
          }
        }}
        onDelete={async (row) => {
          await deleteMutation.mutateAsync(row.id);
        }}
      />
      <div ref={loadMoreRef} className="h-8" />
    </div>
  );
}
