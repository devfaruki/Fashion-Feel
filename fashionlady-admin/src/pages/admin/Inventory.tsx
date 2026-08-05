import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, PackageSearch, Save } from "lucide-react";
import { api, resolveAssetUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "@/hooks/use-toast";
import { cn, getErrorMessage } from "@/lib/utils";

type InventoryItem = {
  id: string;
  productId: number;
  productCode: number;
  productName: string;
  image?: string;
  category: string;
  subCategory: string;
  brand: string;
  type: "simple" | "variant";
  variantIndex?: number;
  size: string;
  color: string;
  sku: string;
  stockQty: number;
  available: number;
  buyingPrice?: number | null;
  oldPrice?: number | null;
  customerPrice?: number | null;
  status: string;
};

type InventoryDraft = Partial<
  Pick<InventoryItem, "stockQty" | "buyingPrice" | "oldPrice" | "customerPrice" | "sku" | "status">
>;

type InventoryGroup = {
  productId: number;
  productCode: number;
  productName: string;
  image?: string;
  category: string;
  subCategory: string;
  brand: string;
  type: "simple" | "variant";
  rows: InventoryItem[];
  totalStock: number;
  totalAvailable: number;
};

function valueOf(item: InventoryItem, drafts: Record<string, InventoryDraft>, key: keyof InventoryDraft) {
  return drafts[item.id]?.[key] ?? item[key as keyof InventoryItem] ?? "";
}

function formatMoney(value: number) {
  return `BDT ${value.toLocaleString()}`;
}

function formatRange(items: InventoryItem[], key: "buyingPrice" | "oldPrice" | "customerPrice") {
  const values = items
    .map((item) => Number(item[key] || 0))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (values.length === 0) return "Not set";
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? formatMoney(min) : `${formatMoney(min)} - ${formatMoney(max)}`;
}

function groupInventory(items: InventoryItem[]) {
  const map = new Map<number, InventoryGroup>();

  for (const item of items) {
    const group = map.get(item.productId) ?? {
      productId: item.productId,
      productCode: item.productCode,
      productName: item.productName,
      image: item.image,
      category: item.category,
      subCategory: item.subCategory,
      brand: item.brand,
      type: item.type,
      rows: [],
      totalStock: 0,
      totalAvailable: 0,
    };

    group.rows.push(item);
    group.image = group.image || item.image;
    group.type = group.rows.some((row) => row.type === "variant") ? "variant" : "simple";
    group.totalStock += Number(item.stockQty || 0);
    group.totalAvailable += Number(item.available || 0);
    map.set(item.productId, group);
  }

  return Array.from(map.values());
}

export default function Inventory() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, InventoryDraft>>({});
  const debouncedSearch = useDebounce(search, 300);

  const inventoryQuery = useQuery({
    queryKey: ["inventory-items", debouncedSearch],
    queryFn: async () => {
      const { data } = await api.get("/inventory/items", {
        params: { search: debouncedSearch },
      });
      return data.data as { items: InventoryItem[]; total: number };
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (item: InventoryItem) => {
      const draft = drafts[item.id] ?? {};
      const payload = {
        type: item.type,
        variantIndex: item.variantIndex,
        size: item.size,
        color: item.color,
        sku: draft.sku ?? item.sku,
        stockQty: draft.stockQty ?? item.stockQty,
        buyingPrice: draft.buyingPrice ?? item.buyingPrice ?? "",
        oldPrice: draft.oldPrice ?? item.oldPrice ?? "",
        customerPrice: draft.customerPrice ?? item.customerPrice ?? "",
        status: draft.status ?? item.status,
      };
      const { data } = await api.patch(`/inventory/item/${item.productId}`, payload);
      return data.data;
    },
    onSuccess: async (_, item) => {
      setDrafts((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: "Inventory updated" });
    },
    onError: (error) => {
      toast({
        title: "Failed to update inventory",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const items = inventoryQuery.data?.items ?? [];
  const groups = useMemo(() => groupInventory(items), [items]);
  const totals = useMemo(
    () => ({
      products: groups.length,
      sku: items.length,
      stock: items.reduce((sum, item) => sum + Number(item.stockQty || 0), 0),
      available: items.reduce((sum, item) => sum + Number(item.available || 0), 0),
    }),
    [groups.length, items],
  );

  const patchDraft = (id: string, patch: InventoryDraft) => {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  };

  const renderEditableRow = (item: InventoryItem, nested = false) => (
    <tr key={item.id} className={cn("align-top", nested && "bg-muted/20")}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-secondary">
            {item.image ? (
              <img src={resolveAssetUrl(item.image)} alt={item.productName} className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div>
            <div className="font-medium">{nested ? "Variant" : item.productName}</div>
            <div className="text-xs text-muted-foreground">
              {nested
                ? [item.size, item.color].filter(Boolean).join(" / ") || "Default"
                : `#${item.productCode}`}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <Input
          value={String(valueOf(item, drafts, "sku"))}
          onChange={(event) => patchDraft(item.id, { sku: event.target.value })}
          className="h-9 w-32"
          disabled={item.type === "simple"}
        />
      </td>
      <td className="px-4 py-3">
        <Input
          type="number"
          min={0}
          value={String(valueOf(item, drafts, "stockQty"))}
          onChange={(event) => patchDraft(item.id, { stockQty: Number(event.target.value) })}
          className="h-9 w-24"
        />
      </td>
      <td className="px-4 py-3">
        <Input
          type="number"
          min={0}
          value={String(valueOf(item, drafts, "buyingPrice"))}
          onChange={(event) => patchDraft(item.id, { buyingPrice: Number(event.target.value) })}
          className="h-9 w-24"
          disabled={item.type === "simple"}
        />
      </td>
      <td className="px-4 py-3">
        <Input
          type="number"
          min={0}
          value={String(valueOf(item, drafts, "oldPrice"))}
          onChange={(event) => patchDraft(item.id, { oldPrice: Number(event.target.value) })}
          className="h-9 w-24"
        />
      </td>
      <td className="px-4 py-3">
        <Input
          type="number"
          min={0}
          value={String(valueOf(item, drafts, "customerPrice"))}
          onChange={(event) => patchDraft(item.id, { customerPrice: Number(event.target.value) })}
          className="h-9 w-24"
        />
      </td>
      <td className="px-4 py-3">
        <select
          value={String(valueOf(item, drafts, "status") || "available")}
          onChange={(event) => patchDraft(item.id, { status: event.target.value })}
          className="h-9 rounded-md border bg-background px-2"
        >
          <option value="available">Available</option>
          <option value="inactive">Inactive</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </td>
      <td className="px-4 py-3 text-right">
        <Button
          size="sm"
          disabled={!drafts[item.id] || updateMutation.isPending}
          onClick={() => updateMutation.mutate(item)}
        >
          <Save className="h-4 w-4" />
          Save
        </Button>
      </td>
    </tr>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-soft lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <PackageSearch className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl">Inventory Management</h1>
            <p className="text-sm text-muted-foreground">
              Product stock and variant stock stay synced with storefront and product edit.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center text-sm">
          <div className="rounded-lg border px-4 py-2">
            <div className="font-semibold">{totals.products}</div>
            <div className="text-xs text-muted-foreground">Products</div>
          </div>
          <div className="rounded-lg border px-4 py-2">
            <div className="font-semibold">{totals.sku}</div>
            <div className="text-xs text-muted-foreground">SKUs</div>
          </div>
          <div className="rounded-lg border px-4 py-2">
            <div className="font-semibold">{totals.stock}</div>
            <div className="text-xs text-muted-foreground">Stock</div>
          </div>
          <div className="rounded-lg border px-4 py-2">
            <div className="font-semibold">{totals.available}</div>
            <div className="text-xs text-muted-foreground">Available</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-soft">
        <div className="border-b p-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search product, brand, category..."
            className="max-w-md"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="bg-secondary/40 text-left">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Buying</th>
                <th className="px-4 py-3">Old</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {inventoryQuery.isLoading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={8}>
                    Loading inventory...
                  </td>
                </tr>
              ) : groups.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={8}>
                    No inventory items found.
                  </td>
                </tr>
              ) : (
                groups.map((group) => {
                  const isVariantProduct = group.type === "variant";
                  const open = expanded[group.productId] ?? false;
                  const simpleItem = group.rows[0];

                  return (
                    <Fragment key={group.productId}>
                      <tr key={`product-${group.productId}`} className="align-top">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              disabled={!isVariantProduct}
                              onClick={() =>
                                setExpanded((current) => ({
                                  ...current,
                                  [group.productId]: !open,
                                }))
                              }
                              className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-md border",
                                !isVariantProduct && "opacity-40",
                              )}
                              aria-label="Toggle variants"
                            >
                              {isVariantProduct && open ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-secondary">
                              {group.image ? (
                                <img
                                  src={resolveAssetUrl(group.image)}
                                  alt={group.productName}
                                  className="h-full w-full object-cover"
                                />
                              ) : null}
                            </div>
                            <div>
                              <div className="font-medium">{group.productName}</div>
                              <div className="text-xs text-muted-foreground">
                                #{group.productCode} - {[group.category, group.subCategory].filter(Boolean).join(" / ")}
                              </div>
                              <div className="mt-1 flex items-center gap-2">
                                <Badge variant={isVariantProduct ? "secondary" : "outline"}>
                                  {isVariantProduct ? `${group.rows.length} variants` : "simple"}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{group.brand}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        {isVariantProduct ? (
                          <>
                            <td className="px-4 py-3 text-muted-foreground">Expand to edit</td>
                            <td className="px-4 py-3 font-medium">{group.totalStock}</td>
                            <td className="px-4 py-3 text-xs">{formatRange(group.rows, "buyingPrice")}</td>
                            <td className="px-4 py-3 text-xs">{formatRange(group.rows, "oldPrice")}</td>
                            <td className="px-4 py-3 text-xs font-medium">{formatRange(group.rows, "customerPrice")}</td>
                            <td className="px-4 py-3">
                              <Badge variant={group.totalStock > 0 ? "secondary" : "destructive"}>
                                {group.totalStock > 0 ? "Available" : "Unavailable"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                              Use arrow to edit variants
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-muted-foreground">Main</td>
                            <td className="px-4 py-3">
                              <Input
                                type="number"
                                min={0}
                                value={String(valueOf(simpleItem, drafts, "stockQty"))}
                                onChange={(event) => patchDraft(simpleItem.id, { stockQty: Number(event.target.value) })}
                                className="h-9 w-24"
                              />
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">-</td>
                            <td className="px-4 py-3">
                              <Input
                                type="number"
                                min={0}
                                value={String(valueOf(simpleItem, drafts, "oldPrice"))}
                                onChange={(event) => patchDraft(simpleItem.id, { oldPrice: Number(event.target.value) })}
                                className="h-9 w-24"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <Input
                                type="number"
                                min={0}
                                value={String(valueOf(simpleItem, drafts, "customerPrice"))}
                                onChange={(event) => patchDraft(simpleItem.id, { customerPrice: Number(event.target.value) })}
                                className="h-9 w-24"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={String(valueOf(simpleItem, drafts, "status") || "available")}
                                onChange={(event) => patchDraft(simpleItem.id, { status: event.target.value })}
                                className="h-9 rounded-md border bg-background px-2"
                              >
                                <option value="available">Available</option>
                                <option value="unavailable">Unavailable</option>
                              </select>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                size="sm"
                                disabled={!drafts[simpleItem.id] || updateMutation.isPending}
                                onClick={() => updateMutation.mutate(simpleItem)}
                              >
                                <Save className="h-4 w-4" />
                                Save
                              </Button>
                            </td>
                          </>
                        )}
                      </tr>
                      {isVariantProduct && open && group.rows.map((item) => renderEditableRow(item, true))}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
