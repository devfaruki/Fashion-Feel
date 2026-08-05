import { useEffect, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CrudTable } from "@/components/admin/CrudTable";
import { api, resolveAssetUrl } from "@/lib/api";
import { getFileObjects } from "@/lib/file-utils";
import type { Brand, Category, Product } from "@/types/store";
import { useDebounce } from "@/hooks/use-debounce";
import { getPrimaryImage } from "@/lib/product-images";
import { cn, getErrorMessage } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type StitchType = "stitch" | "unstitch";
type ProductRow = Omit<Product, "sizes"> & { sizes: string; stitchType: StitchType };

const UNSTITCHED_SIZE = "Unstitch";

function getStitchTypeFromSizes(sizes?: string[] | string | null): StitchType {
  const sizeList = Array.isArray(sizes)
    ? sizes
    : typeof sizes === "string"
      ? sizes.split(",").map((size) => size.trim())
      : [];

  return sizeList.some((size) => size.toLowerCase() === UNSTITCHED_SIZE.toLowerCase()) ? "unstitch" : "stitch";
}

function parseProductSizes(data: Partial<ProductRow>) {
  if (data.stitchType === "unstitch") return [UNSTITCHED_SIZE];

  return String(data.sizes || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function getPreviewImages(product: ProductRow) {
  const rawImages = [
    ...(Array.isArray(product.images) ? product.images : []),
    ...((product.variants ?? []).map((variant) => variant.image).filter(Boolean) as string[]),
  ];
  const images = rawImages
    .map((image) => resolveAssetUrl(image))
    .filter((image): image is string => Boolean(image));

  return Array.from(new Set(images));
}

function getPreviewImage(product: ProductRow) {
  return getPreviewImages(product)[0] || getPrimaryImage(product as unknown as Product);
}

function getVariantPriceRange(product: ProductRow) {
  const prices = (product.variants ?? [])
    .filter((variant) => variant.active !== false)
    .map((variant) => Number(variant.customerPrice || 0))
    .filter((price) => Number.isFinite(price) && price > 0);

  if (prices.length === 0) return null;
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}

function formatProductPrice(product: ProductRow) {
  const range = product.priceRange ?? getVariantPriceRange(product);
  if (range) {
    return range.min === range.max
      ? `BDT ${range.min.toLocaleString()}`
      : `BDT ${range.min.toLocaleString()} - ${range.max.toLocaleString()}`;
  }

  return `BDT ${product.price.toLocaleString()}`;
}

export default function Products() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkExcelFile, setBulkExcelFile] = useState<File | null>(null);
  const [bulkZipFile, setBulkZipFile] = useState<File | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data } = await api.get("/category/all-categories", {
        params: { limit: 200 },
      });
      return data.data.categories as Category[];
    },
  });

  const brandsQuery = useQuery({
    queryKey: ["admin-brands"],
    queryFn: async () => {
      const { data } = await api.get("/brand/all-brands", {
        params: { limit: 200 },
      });
      return data.data.brands as Brand[];
    },
  });

  const productsQuery = useInfiniteQuery({
    queryKey: ["admin-products", debouncedSearch],
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get("/product/all-products", {
        params: { page: pageParam, limit: 10, search: debouncedSearch },
      });
      return data.data as {
        products: Product[];
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

  const mappedProducts = useMemo(
    () =>
      (productsQuery.data?.pages.flatMap((p) => p.products) ?? []).map((p) => ({
        ...p,
        sizes: Array.isArray(p.sizes) ? p.sizes.join(", ") : (p.sizes ?? ""),
        stitchType: getStitchTypeFromSizes(p.sizes),
      })),
    [productsQuery.data?.pages],
  );

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          productsQuery.hasNextPage &&
          !productsQuery.isFetchingNextPage
        ) {
          productsQuery.fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [productsQuery]);

  const createMutation = useMutation({
    mutationFn: async (payload: FormData) => {
      const { data } = await api.post("/product/add-product", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data.data as ProductRow;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: number;
      payload: FormData | Partial<Product>;
    }) => {
      const isFormData = payload instanceof FormData;
      const { data } = await api.patch(
        `/product/update-product/${id}`,
        payload,
        isFormData
          ? { headers: { "Content-Type": "multipart/form-data" } }
          : undefined,
      );
      return data.data as ProductRow;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.delete(`/product/delete-product/${id}`);
      return data.data as ProductRow;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (payload: FormData) => {
      const { data } = await api.post("/product/bulk-import-products", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data.data as {
        totalRows: number;
        created: number;
        failed: number;
        results: Array<{
          rowNumber: number;
          productId?: number;
          status: "success" | "failed";
          imageCount?: number;
          errors?: string[];
        }>;
      };
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({
        title: "Bulk import finished",
        description: `${data.created} created, ${data.failed} failed.`,
      });
      setBulkOpen(false);
      setBulkExcelFile(null);
      setBulkZipFile(null);
    },
  });

  const categoryOptions = useMemo(
    () =>
      (categoriesQuery.data ?? []).map((c) => ({ label: c.name, value: c.id })),
    [categoriesQuery.data],
  );

  const getSubCategoryOptions = useMemo(
    () => (values: Record<string, unknown>) => {
      const selectedCategoryId = Number(values.categoryId || 0);
      const category = (categoriesQuery.data ?? []).find((item) => item.id === selectedCategoryId);
      return (category?.subCategories ?? []).map((subCategory) => ({
        label: subCategory.name,
        value: subCategory.id,
      }));
    },
    [categoriesQuery.data],
  );

  const brandOptions = useMemo(
    () => (brandsQuery.data ?? []).map((b) => ({ label: b.name, value: b.id })),
    [brandsQuery.data],
  );

  const downloadBulkTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet([
      {
        productId: 1001,
        name: "Sample Product",
        price: 1200,
        oldPrice: 1500,
        badge: "New",
        stitchType: "stitch",
        sizes: "S, M, L",
        productSummary: "Size guide and quick product notes",
        stock: "available",
        stockQty: 20,
        stockReserved: 0,
        lowStockThreshold: 5,
        description: "Sample description",
        isNew: true,
        isFeatured: false,
        categoryName: "",
        brandName: "",
        order: 0,
      },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "bulk-product-template.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  };

  const bulkToolbar = (
    <Button
      type="button"
      variant="outline"
      onClick={() => setBulkOpen(true)}
      className="h-10 rounded-xl"
    >
      Bulk Add
    </Button>
  );

  return (
    <div className="space-y-6 text-nowrap">
      <CrudTable<ProductRow>
        entityName="Product"
        initialRows={[]}
        rows={mappedProducts}
        isLoading={productsQuery.isLoading}
        disableLocalFilter
        onSearchChange={setSearch}
        searchKeys={["name"]}
        newRow={() => ({
          price: 0,
          images: [],
          stitchType: "unstitch",
        })}
        fields={[
          { key: "name", label: "Name" },
          {
            key: "categoryId",
            label: "Category",
            type: "select",
            options: categoryOptions,
          },
          {
            key: "subCategoryId",
            label: "Sub Category",
            type: "select",
            options: getSubCategoryOptions,
          },
          {
            key: "brandId",
            label: "Brand",
            type: "select",
            options: brandOptions,
          },
          { key: "price", label: "Price (BDT)", type: "number" },
          { key: "oldPrice", label: "Old Price (BDT)", type: "number" },
          { key: "stockQty", label: "Stock", type: "number" },
          { key: "badge", label: "Badge" },
          {
            key: "stitchType",
            label: "Size Type",
            type: "select",
            options: [
              { label: "Stitch", value: "stitch" },
              { label: "Unstitch", value: "unstitch" },
            ],
          },
          {
            key: "sizes",
            label: "Sizes (comma)",
            placeholder: "S, M, L",
            showWhen: (values) => values.stitchType !== "unstitch",
          },
          { key: "productSummary", label: "Product Summary", type: "textarea" },
          { key: "description", label: "Product Description", type: "textarea" },
          { key: "isNew", label: "New", type: "checkbox" },
          { key: "isFeatured", label: "Featured", type: "checkbox" },
          {
            key: "stock",
            label: "Stock Status",
            type: "select",
            options: [
              { label: "Available", value: "available" },
              { label: "Unavailable", value: "unavailable" },
            ],
          },
          { key: "images", label: "Images", type: "file", multiple: true },
        ]}
        columns={[
          {
            key: "name",
            label: "Product",
            render: (p: ProductRow) => (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-secondary">
                  {getPreviewImage(p) ? (
                    <img
                      src={getPreviewImage(p)}
                      alt={p.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-xl">🛍️</span>
                  )}
                </div>
                <div className="leading-tight">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    {[p.category?.name, p.subCategory?.name].filter(Boolean).join(" / ")}
                    <span className="text-[10px] opacity-30">•</span>
                    <span className={cn(
                      "text-[9px] font-bold uppercase tracking-wider",
                      p.stock === "available" ? "text-emerald-500" : "text-red-500"
                    )}>
                      {p.stock === "available" ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
            ),
          },
          { key: "brand", label: "Brand", render: (p) => p.brand?.name ?? "" },
          {
            key: "price",
            label: "Price",
            align: "right",
            render: (p) => formatProductPrice(p),
          },
          {
            key: "stockQty",
            label: "Stock",
            align: "right",
            render: (p) => `${p.stockQty ?? 0}`,
          },
          {
            key: "isFeatured",
            label: "Flags",
            render: (p) => (
              <div className="flex items-center gap-2">
                {p.isNew && <Badge variant="secondary">New</Badge>}
                {p.isFeatured && <Badge variant="outline">Featured</Badge>}
              </div>
            ),
          },
          {
            key: "stock",
            label: "Active",
            render: (p: ProductRow) => (
              <div className="flex items-center gap-3">
                <Switch 
                  checked={p.stock === "available"}
                  onCheckedChange={async (checked) => {
                    try {
                      const newStatus = checked ? "available" : "unavailable";
                      await updateMutation.mutateAsync({
                        id: p.id,
                        payload: { stock: newStatus },
                      });
                      toast({
                        title: "Status Updated",
                        description: `Product is now ${newStatus}.`,
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
        renderDetails={(p: ProductRow) => (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 overflow-hidden rounded-xl bg-secondary">
                {getPreviewImage(p) ? (
                  <img
                    src={getPreviewImage(p)}
                    alt={p.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl">
                    🛍️
                  </div>
                )}
              </div>
              <div className="leading-tight">
                <div className="text-xs uppercase text-muted-foreground">
                  Name
                </div>
                <div className="font-medium">{p.name}</div>
              </div>
            </div>
            {getPreviewImages(p).length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {getPreviewImages(p).map((image) => (
                  <div key={image} className="aspect-square overflow-hidden rounded-md border bg-muted">
                    <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
            )}
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase text-muted-foreground">
                  Category
                </div>
                <div>{[p.category?.name, p.subCategory?.name].filter(Boolean).join(" / ")}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">
                  Brand
                </div>
                <div>{p.brand?.name ?? ""}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">
                  Price
                </div>
                <div>{formatProductPrice(p)}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">
                  Stock
                </div>
                <div>{p.stockQty ?? 0}</div>
              </div>
            </div>
            {(p.variants ?? []).filter((variant) => variant.active !== false).length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Variant Details
                </div>
                <div className="grid gap-2">
                  {(p.variants ?? [])
                    .filter((variant) => variant.active !== false)
                    .map((variant, index) => (
                      <div
                        key={`${variant.size}-${variant.color}-${index}`}
                        className="grid gap-2 rounded-lg border bg-background p-3 text-sm sm:grid-cols-[1fr_auto_auto]"
                      >
                        <div className="font-medium">
                          {[variant.size, variant.color].filter(Boolean).join(" / ")}
                          {variant.sku ? (
                            <span className="ml-2 text-xs text-muted-foreground">SKU {variant.sku}</span>
                          ) : null}
                        </div>
                        <div>BDT {Number(variant.customerPrice || p.price).toLocaleString()}</div>
                        <div>Stock {Number(variant.openingStock || 0).toLocaleString()}</div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
        onCreate={async (data) => {
          const files = getFileObjects(
            data.images as unknown as FileList | null,
          );
          const variantFiles = getFileObjects(
            (data as Record<string, unknown>).variantImages as File[] | null,
          );
          const sizes = parseProductSizes(data);

          // Build FormData for multipart upload
          const formData = new FormData();
          formData.append("name", String(data.name || ""));
          formData.append("price", String(Number(data.price || 0)));
          formData.append(
            "oldPrice",
            data.oldPrice ? String(Number(data.oldPrice)) : "null",
          );
          formData.append(
            "stockQty",
            data.stockQty ? String(Number(data.stockQty)) : "0",
          );
          formData.append(
            "stock",
            data.stock ? String(data.stock) : "available",
          );
          formData.append(
            "badge",
            data.badge ? String(data.badge) : "",
          );
          formData.append("sizes", JSON.stringify(sizes));
          formData.append(
            "colors",
            JSON.stringify((data as Record<string, unknown>).colors ?? []),
          );
          formData.append(
            "variants",
            JSON.stringify((data as Record<string, unknown>).variants ?? []),
          );
          formData.append(
            "productSummary",
            data.productSummary ? String(data.productSummary) : "",
          );
          formData.append(
            "description",
            data.description ? String(data.description) : "",
          );
          formData.append("isNew", String(Boolean(data.isNew)));
          formData.append("isFeatured", String(Boolean(data.isFeatured)));
          formData.append(
            "categoryId",
            data.categoryId ? String(Number(data.categoryId)) : "null",
          );
          formData.append(
            "subCategoryId",
            data.subCategoryId ? String(Number(data.subCategoryId)) : "null",
          );
          formData.append(
            "brandId",
            data.brandId ? String(Number(data.brandId)) : "null",
          );

          // Attach main product images and variant images separately.
          for (const file of files) {
            formData.append("images", file);
          }
          for (const file of variantFiles) {
            formData.append("variantImages", file);
          }

          await createMutation.mutateAsync(formData);
        }}
        onUpdate={async (row, data) => {
          const hasValue = (key: keyof ProductRow) =>
            Object.prototype.hasOwnProperty.call(data, key);
          const files = getFileObjects(
            data.images as unknown as FileList | null,
          );
          const variantFiles = getFileObjects(
            (data as Record<string, unknown>).variantImages as File[] | null,
          );
          const allFiles = [...files, ...variantFiles];
          const removeImages = Array.isArray(
            (data as Record<string, unknown>).imagesRemoveList,
          )
            ? (
                (data as Record<string, unknown>).imagesRemoveList as unknown[]
              ).filter((v): v is string => typeof v === "string")
            : [];
          const removeImagePaths = removeImages.map((img) => {
            const match = img.match(/\/public\/.+$/);
            return match ? match[0] : img;
          });
          const stitchType = data.stitchType || row.stitchType || "stitch";
          const sizes = parseProductSizes({
            ...data,
            stitchType,
            sizes: stitchType === "unstitch" ? "" : data.sizes ?? row.sizes,
          });

          // If no files to upload and no images to remove, send plain JSON (faster)
          if (allFiles.length === 0 && removeImagePaths.length === 0) {
            const payload: Partial<Product> & {
              addImages?: string[];
              removeImages?: string[];
            } = {
              name: hasValue("name") ? String(data.name ?? "") : row.name,
              price: hasValue("price") ? Number(data.price ?? 0) : row.price,
              oldPrice: hasValue("oldPrice") && data.oldPrice !== ""
                ? Number(data.oldPrice)
                : null,
              stockQty: hasValue("stockQty")
                ? Number(data.stockQty ?? 0)
                : (row.stockQty ?? 0),
              stock: hasValue("stock") ? String(data.stock ?? "") : row.stock,
              badge: hasValue("badge") ? String(data.badge ?? "") : (row.badge ?? null),
              description: hasValue("description")
                ? String(data.description ?? "")
                : (row.description ?? null),
              productSummary: hasValue("productSummary")
                ? String(data.productSummary ?? "")
                : (row.productSummary ?? null),
              isNew:
                typeof data.isNew === "boolean"
                  ? data.isNew
                  : (row.isNew ?? false),
              isFeatured:
                typeof data.isFeatured === "boolean"
                  ? data.isFeatured
                  : (row.isFeatured ?? false),
              categoryId: hasValue("categoryId") && data.categoryId
                ? Number(data.categoryId)
                : (row.categoryId ?? null),
              subCategoryId: hasValue("subCategoryId") && data.subCategoryId
                ? Number(data.subCategoryId)
                : (row.subCategoryId ?? null),
              brandId: hasValue("brandId") && data.brandId
                ? Number(data.brandId)
                : (row.brandId ?? null),
              colors: ((data as Record<string, unknown>).colors as string[]) ?? row.colors ?? [],
              variants:
                ((data as Record<string, unknown>).variants as Product["variants"]) ??
                row.variants ??
                [],
            };

            payload.sizes = sizes;
            payload.removeImages = removeImagePaths;

            await updateMutation.mutateAsync({ id: row.id, payload });
            return;
          }

          // Build FormData for multipart upload
          const formData = new FormData();
          formData.append("name", hasValue("name") ? String(data.name ?? "") : row.name);
          formData.append(
            "price",
            String(hasValue("price") ? Number(data.price ?? 0) : row.price),
          );
          formData.append(
            "oldPrice",
            hasValue("oldPrice") && data.oldPrice !== ""
              ? String(Number(data.oldPrice))
              : "null",
          );
          formData.append(
            "stockQty",
            String(hasValue("stockQty") ? Number(data.stockQty ?? 0) : row.stockQty ?? 0),
          );
          formData.append(
            "stock",
            hasValue("stock") ? String(data.stock ?? "") : row.stock || "available",
          );
          formData.append(
            "badge",
            hasValue("badge") ? String(data.badge ?? "") : row.badge || "",
          );
          formData.append(
            "productSummary",
            hasValue("productSummary")
              ? String(data.productSummary ?? "")
              : row.productSummary || "",
          );
          formData.append(
            "description",
            hasValue("description")
              ? String(data.description ?? "")
              : row.description || "",
          );
          formData.append(
            "isNew",
            String(
              typeof data.isNew === "boolean"
                ? data.isNew
                : row.isNew ?? false,
            ),
          );
          formData.append(
            "isFeatured",
            String(
              typeof data.isFeatured === "boolean"
                ? data.isFeatured
                : row.isFeatured ?? false,
            ),
          );
          formData.append(
            "categoryId",
            data.categoryId
              ? String(Number(data.categoryId))
              : row.categoryId
                ? String(row.categoryId)
                : "null",
          );
          formData.append(
            "subCategoryId",
            data.subCategoryId
              ? String(Number(data.subCategoryId))
              : row.subCategoryId
                ? String(row.subCategoryId)
                : "null",
          );
          formData.append(
            "brandId",
            data.brandId
              ? String(Number(data.brandId))
              : row.brandId
                ? String(row.brandId)
                : "null",
          );

          formData.append("sizes", JSON.stringify(sizes));
          formData.append(
            "colors",
            JSON.stringify((data as Record<string, unknown>).colors ?? row.colors ?? []),
          );
          formData.append(
            "variants",
            JSON.stringify(
              (data as Record<string, unknown>).variants ?? row.variants ?? [],
            ),
          );

          // Attach new image files
          for (const file of files) {
            formData.append("addImages", file);
          }
          for (const file of variantFiles) {
            formData.append("variantImages", file);
          }

          // Send remove list as JSON string
          if (removeImagePaths.length > 0) {
            formData.append(
              "removeImages",
              JSON.stringify(removeImagePaths),
            );
          }

          await updateMutation.mutateAsync({ id: row.id, payload: formData });
        }}
        onDelete={async (row) => {
          await deleteMutation.mutateAsync(row.id);
        }}
        toolbarActions={bulkToolbar}
      />
      <div ref={loadMoreRef} className="h-8" />

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Bulk add products</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground space-y-2">
              <p>Upload one Excel file and one ZIP file. Each Excel row must include a unique `productId`.</p>
              <p>Put images in the ZIP under a folder or filename that starts with the same `productId`.</p>
              <p>Example: `1001/main.webp`, `1001/side-1.jpg`, `1002/front.png`.</p>
              <p>Use `categoryName` and `brandName` columns instead of IDs.</p>
              <p>Use `stitchType` as `stitch` or `unstitch`; when unstitch, the sizes value will be treated as `Unstitch`.</p>
              <p>Maximum 500 products per import.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk-excel">Excel file</Label>
              <Input
                id="bulk-excel"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setBulkExcelFile(e.target.files?.[0] ?? null)}
              />
              <div className="text-xs text-muted-foreground">
                Current file: {bulkExcelFile ? bulkExcelFile.name : "none"}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk-zip">Images ZIP file</Label>
              <Input
                id="bulk-zip"
                type="file"
                accept=".zip"
                onChange={(e) => setBulkZipFile(e.target.files?.[0] ?? null)}
              />
              <div className="text-xs text-muted-foreground">
                Current file: {bulkZipFile ? bulkZipFile.name : "none"}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={downloadBulkTemplate}>
                Download Excel Template
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkImportMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-gradient-primary text-primary-foreground"
              disabled={!bulkExcelFile || !bulkZipFile || bulkImportMutation.isPending}
              onClick={async () => {
                if (!bulkExcelFile || !bulkZipFile) return;

                const formData = new FormData();
                formData.append("excel", bulkExcelFile);
                formData.append("imagesZip", bulkZipFile);

                try {
                  await bulkImportMutation.mutateAsync(formData);
                } catch (error: unknown) {
                  const message = getErrorMessage(error) || "Failed to import products";
                  toast({
                    title: "Bulk import failed",
                    description: message,
                    variant: "destructive",
                  });
                }
              }}
            >
              {bulkImportMutation.isPending ? "Importing..." : "Start Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
