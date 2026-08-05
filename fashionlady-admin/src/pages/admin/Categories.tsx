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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, getErrorMessage } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type CategoryRow = Category;

export default function Categories() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [subCategoryDrafts, setSubCategoryDrafts] = useState<Record<number, string>>({});
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

  const createSubCategoryMutation = useMutation({
    mutationFn: async (payload: { categoryId: number; name: string; status?: string }) => {
      const { data } = await api.post("/category/add-subcategory", payload);
      return data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-categories"] }),
  });

  const updateSubCategoryMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: { name?: string; status?: string } }) => {
      const { data } = await api.patch(`/category/update-subcategory/${id}`, payload);
      return data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-categories"] }),
  });

  const deleteSubCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.delete(`/category/delete-subcategory/${id}`);
      return data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-categories"] }),
  });

  return (
    <div className="space-y-6 text-nowrap">
      <div className="rounded-xl border bg-card p-4 shadow-soft">
        <div className="mb-4 flex flex-col gap-1">
          <h2 className="font-display text-2xl">Sub Category Manager</h2>
          <p className="text-sm text-muted-foreground">
            Add one or more sub categories under each parent category.
          </p>
        </div>
        {categoriesQuery.isLoading ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Loading categories...
          </div>
        ) : categories.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Create a category first, then add sub categories here.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {categories.map((category) => (
              <div key={category.id} className="rounded-lg border bg-muted/20 p-3">
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-11 w-11 overflow-hidden rounded-lg bg-secondary">
                    {category.image ? (
                      <img
                        src={resolveAssetUrl(category.image)}
                        alt={category.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                  <div>
                    <div className="font-medium">{category.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(category.subCategories ?? []).length} sub categories
                    </div>
                  </div>
                </div>
                <div className="mb-3 flex flex-wrap gap-2">
                  {(category.subCategories ?? []).length > 0 ? (
                    (category.subCategories ?? []).map((subCategory) => (
                      <span
                        key={subCategory.id}
                        className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs"
                      >
                        {subCategory.name}
                        <button
                          type="button"
                          className="text-red-500"
                          onClick={() => deleteSubCategoryMutation.mutate(subCategory.id)}
                        >
                          x
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">No sub categories yet.</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={subCategoryDrafts[category.id] ?? ""}
                    onChange={(event) =>
                      setSubCategoryDrafts((current) => ({
                        ...current,
                        [category.id]: event.target.value,
                      }))
                    }
                    placeholder={`Add sub category under ${category.name}`}
                  />
                  <Button
                    type="button"
                    disabled={createSubCategoryMutation.isPending}
                    onClick={async () => {
                      const name = (subCategoryDrafts[category.id] ?? "").trim();
                      if (!name) return;
                      await createSubCategoryMutation.mutateAsync({
                        categoryId: category.id,
                        name,
                        status: "active",
                      });
                      setSubCategoryDrafts((current) => ({ ...current, [category.id]: "" }));
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
            render: (c) => c.count ?? c._count?.products ?? 0,
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
              <div>{c.count ?? c._count?.products ?? 0}</div>
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase text-muted-foreground">
                Sub Categories
              </div>
              <div className="space-y-2">
                {(c.subCategories ?? []).map((subCategory) => (
                  <div key={subCategory.id} className="flex items-center gap-2 rounded-lg border p-2">
                    <Input
                      defaultValue={subCategory.name}
                      className="h-9"
                      onBlur={(event) => {
                        const name = event.target.value.trim();
                        if (name && name !== subCategory.name) {
                          updateSubCategoryMutation.mutate({
                            id: subCategory.id,
                            payload: { name },
                          });
                        }
                      }}
                    />
                    <Switch
                      checked={subCategory.status === "active"}
                      onCheckedChange={(checked) =>
                        updateSubCategoryMutation.mutate({
                          id: subCategory.id,
                          payload: { status: checked ? "active" : "inactive" },
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => deleteSubCategoryMutation.mutate(subCategory.id)}
                    >
                      Delete
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={subCategoryDrafts[c.id] ?? ""}
                    onChange={(event) =>
                      setSubCategoryDrafts((current) => ({
                        ...current,
                        [c.id]: event.target.value,
                      }))
                    }
                    placeholder="New sub category name"
                  />
                  <Button
                    type="button"
                    onClick={async () => {
                      const name = (subCategoryDrafts[c.id] ?? "").trim();
                      if (!name) return;
                      await createSubCategoryMutation.mutateAsync({
                        categoryId: c.id,
                        name,
                        status: "active",
                      });
                      setSubCategoryDrafts((current) => ({ ...current, [c.id]: "" }));
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
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
