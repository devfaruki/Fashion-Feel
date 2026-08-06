import { useEffect, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Badge,
} from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  RefreshCw,
  Search,
  X,
  Minus,
  Loader2,
  Eye,
  Edit3,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";
import type { Product, Order } from "@/types/store";

type CreateSaleItem = {
  lineId: string;
  productId: number;
  name: string;
  image: string;
  size: string;
  variantSize: string;
  variantColor: string;
  quantity: number;
  price: number;
  stock: number | null;
};

type OfflineSaleOrder = Order & {
  saleSource?: string | null;
};

type ProductVariant = NonNullable<NonNullable<Product["variants"]>[number]>;

const statusStyles: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-700 border-emerald-200",
  PENDING: "bg-secondary text-secondary-foreground border-border",
  SHIPPED: "bg-blue-100 text-blue-700 border-blue-200",
  DELIVERED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-destructive/10 text-destructive border-destructive/20",
};

const paymentMethodLabels: Record<string, string> = {
  CASHON: "Cash Payment",
  BKASH: "Bkash Payment",
  NAGAD: "Nagad Payment",
  ROCKET: "Rocket Payment",
  CARD: "Card Payment",
};

const getProductImage = (product?: Product | null, variantImage?: string) => {
  const image = variantImage || product?.images?.[0] || "";
  return image.startsWith("http") || image.startsWith("/") ? image : image;
};

const getActiveProductVariants = (product?: Product | null) =>
  (product?.variants ?? []).filter((variant) => variant && variant.active !== false);

const getVariantStock = (variant?: ProductVariant) => {
  const stock = Number.parseInt(String(variant?.openingStock ?? 0), 10);
  return Number.isFinite(stock) && stock >= 0 ? stock : 0;
};

const splitVariantLabel = (label: string) => {
  const [size, ...colorParts] = label.split("/").map((part) => part.trim());
  return {
    size: size || label,
    color: colorParts.join(" / "),
  };
};

const formatBDT = (amount: number) =>
  new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(amount);

const orderNumber = (o: OfflineSaleOrder) =>
  `FL-${String(o.id).padStart(4, "0")}`;

const itemsTotal = (o: OfflineSaleOrder) =>
  Array.isArray(o.items)
    ? o.items.reduce((sum, item) => sum + (item.price ?? 0) * (item.quantity ?? item.qty ?? 1), 0)
    : 0;

const formatDate = (d: string) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-BD", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export default function OfflineSales() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [createSaleOpen, setCreateSaleOpen] = useState(false);
  const [viewingSale, setViewingSale] = useState<OfflineSaleOrder | null>(null);
  const [editingSale, setEditingSale] = useState<OfflineSaleOrder | null>(null);
  const [deleteSale, setDeleteSale] = useState<OfflineSaleOrder | null>(null);
  const [createCustomer, setCreateCustomer] = useState({
    name: "",
    phone: "",
    address: "",
  });
  const [createPaymentMethod, setCreatePaymentMethod] = useState("CASHON");
  const [createNote, setCreateNote] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const debouncedProductSearch = useDebounce(productSearch, 300);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVariantKey, setSelectedVariantKey] = useState("");
  const [createItems, setCreateItems] = useState<CreateSaleItem[]>([]);
  const [creatingSale, setCreatingSale] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingSale, setDeletingSale] = useState(false);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState("CASHON");
  const [editingNote, setEditingNote] = useState("");

  const offlineSalesQuery = useInfiniteQuery({
    queryKey: ["admin-offline-sales", debouncedSearch],
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get("/order/all-order", {
        params: {
          page: pageParam,
          limit: 10,
          search: debouncedSearch,
          saleSource: "OFFLINE",
        },
      });
      return data.data as {
        orders: OfflineSaleOrder[];
        total: number;
        page: number;
        limit: number;
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const nextPage = lastPage.page + 1;
      return lastPage.page * lastPage.limit < lastPage.total ? nextPage : undefined;
    },
  });

  const orders = offlineSalesQuery.data?.pages.flatMap((p) => p.orders) ?? [];

  const productsQuery = useQuery({
    queryKey: ["order-create-products", debouncedProductSearch],
    queryFn: async () => {
      const { data } = await api.get("/product/all-products", {
        params: {
          page: 1,
          limit: 20,
          activeOnly: true,
          search: debouncedProductSearch,
        },
      });
      return data.data.products as Product[];
    },
    enabled: createSaleOpen,
  });

  const productOptions = productsQuery.data ?? [];
  const selectedProduct = productOptions.find((product) => String(product.id) === selectedProductId) ?? null;
  const selectedProductVariants = getActiveProductVariants(selectedProduct);
  const selectedVariant = selectedProductVariants.find((variant, index) => {
    const key = `${index}:${variant.size || ""}:${variant.color || ""}`;
    return key === selectedVariantKey;
  });

  const createSubtotal = createItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const createTotal = createSubtotal;

  useEffect(() => {
    setSelectedVariantKey("");
  }, [selectedProductId]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && offlineSalesQuery.hasNextPage && !offlineSalesQuery.isFetchingNextPage) {
          offlineSalesQuery.fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [offlineSalesQuery]);

  const updateCreateCustomer = (key: keyof typeof createCustomer, value: string) => {
    setCreateCustomer((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const addSelectedProductToSale = () => {
    if (!selectedProduct) {
      toast({ title: "Select a product first", variant: "destructive" });
      return;
    }

    const hasVariants = selectedProductVariants.length > 0;
    if (hasVariants && !selectedVariant) {
      toast({ title: "Select a variant first", variant: "destructive" });
      return;
    }

    const variantLabel = selectedVariant
      ? [selectedVariant.size, selectedVariant.color].filter(Boolean).join(" / ")
      : selectedProduct.sizes?.[0] || "Standard";
    const selection = splitVariantLabel(variantLabel);
    const price = Number(selectedVariant?.customerPrice || selectedProduct.price || 0);
    const stock = selectedVariant ? getVariantStock(selectedVariant) : selectedProduct.stockQty ?? null;
    const image = getProductImage(selectedProduct, selectedVariant?.image);

    setCreateItems((current) => [
      ...current,
      {
        lineId: `${selectedProduct.id}-${selectedVariantKey || "simple"}-${Date.now()}`,
        productId: selectedProduct.id,
        name: selectedProduct.name,
        image,
        size: variantLabel,
        variantSize: selection.size,
        variantColor: selection.color,
        quantity: 1,
        price,
        stock,
      },
    ]);
  };

  const updateCreateItem = (lineId: string, patch: Partial<CreateSaleItem>) => {
    setCreateItems((current) => current.map((item) => (item.lineId === lineId ? { ...item, ...patch } : item)));
  };

  const removeCreateItem = (lineId: string) => {
    setCreateItems((current) => current.filter((item) => item.lineId !== lineId));
  };

  const resetCreateSale = () => {
    setCreateCustomer({ name: "", phone: "", address: "" });
    setCreatePaymentMethod("CASHON");
    setCreateNote("");
    setProductSearch("");
    setSelectedProductId("");
    setSelectedVariantKey("");
    setCreateItems([]);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      return api.post("/order/add-offline-sale", {
        name: createCustomer.name.trim(),
        phone: createCustomer.phone.trim(),
        address: createCustomer.address.trim(),
        totalPrice: createTotal,
        paymentMethod: createPaymentMethod,
        note: createNote.trim() || null,
        saleSource: "OFFLINE",
        items: createItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          name: item.name,
          price: item.price,
          size: item.size,
          variantSize: item.variantSize,
          variantColor: item.variantColor,
          image: item.image,
        })),
      });
    },
    onSuccess: async () => {
      toast({ title: "Offline sale saved" });
      await queryClient.invalidateQueries({ queryKey: ["admin-offline-sales"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setCreateSaleOpen(false);
      resetCreateSale();
    },
    onError: (error) => {
      toast({
        title: "Failed to save offline sale",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const updateSaleMutation = useMutation({
    mutationFn: async () => {
      if (!editingSale) throw new Error("No sale selected");
      return api.patch(`/order/update-order/${editingSale.id}`, {
        paymentMethod: editingPaymentMethod,
        note: editingNote.trim() || null,
      });
    },
    onSuccess: async () => {
      toast({ title: "Offline sale updated" });
      await queryClient.invalidateQueries({ queryKey: ["admin-offline-sales"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setEditingSale(null);
    },
    onError: (error) => {
      toast({
        title: "Failed to update offline sale",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const deleteSaleMutation = useMutation({
    mutationFn: async (saleId: number) => {
      return api.delete(`/order/delete-order/${saleId}`);
    },
    onSuccess: async () => {
      toast({ title: "Offline sale deleted" });
      await queryClient.invalidateQueries({ queryKey: ["admin-offline-sales"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setDeleteSale(null);
    },
    onError: (error) => {
      toast({
        title: "Failed to delete offline sale",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async () => {
    if (!createCustomer.name.trim() || !createCustomer.phone.trim() || !createCustomer.address.trim()) {
      toast({ title: "Customer information required", description: "Name, phone, and address are required.", variant: "destructive" });
      return;
    }
    if (createItems.length === 0) {
      toast({ title: "Add at least one product", variant: "destructive" });
      return;
    }

    const invalidItem = createItems.find((item) => item.quantity < 1 || item.price < 0);
    if (invalidItem) {
      toast({ title: "Invalid item quantity or price", variant: "destructive" });
      return;
    }

    setCreatingSale(true);
    try {
      await createMutation.mutateAsync();
    } finally {
      setCreatingSale(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingSale) return;
    setSavingEdit(true);
    try {
      await updateSaleMutation.mutateAsync();
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteSale) return;
    setDeletingSale(true);
    try {
      await deleteSaleMutation.mutateAsync(deleteSale.id);
    } finally {
      setDeletingSale(false);
    }
  };

  const paymentMethodOptions = useMemo(
    () => [
      { value: "CASHON", label: "Cash Payment" },
      { value: "BKASH", label: "Bkash Payment" },
      { value: "NAGAD", label: "Nagad Payment" },
      { value: "ROCKET", label: "Rocket Payment" },
      { value: "CARD", label: "Card Payment" },
    ],
    [],
  );

  const productSummary = createItems.length
    ? `${createItems.length} item${createItems.length === 1 ? "" : "s"} · ${formatBDT(createTotal)}`
    : "No products added";

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-3 p-4 shadow-soft md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search offline sales by order #, customer, status…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 rounded-xl pl-9"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => setCreateSaleOpen(true)} className="h-10 rounded-xl">
            <Plus className="mr-2 h-4 w-4" /> Offline Sale
          </Button>
          <Button onClick={() => offlineSalesQuery.refetch()} variant="outline" className="h-10 rounded-xl">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden shadow-soft text-nowrap">
        <div className="overflow-x-auto">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow className="bg-secondary/40">
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offlineSalesQuery.isLoading &&
                orders.length === 0 &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 w-6 rounded bg-muted" /></TableCell>
                    <TableCell><div className="h-4 w-20 rounded bg-muted" /></TableCell>
                    <TableCell><div className="h-4 w-32 rounded bg-muted" /></TableCell>
                    <TableCell><div className="h-4 w-20 rounded bg-muted" /></TableCell>
                    <TableCell><div className="h-4 w-20 rounded bg-muted" /></TableCell>
                    <TableCell><div className="h-4 w-24 rounded bg-muted" /></TableCell>
                    <TableCell><div className="h-4 w-20 rounded bg-muted" /></TableCell>
                    <TableCell><div className="h-4 w-20 rounded bg-muted ml-auto" /></TableCell>
                  </TableRow>
                ))}
              {orders.map((order, idx) => (
                <TableRow key={order.id} className="hover:bg-secondary/30">
                  <TableCell className="text-center text-muted-foreground text-sm">{idx + 1}</TableCell>
                  <TableCell className="font-medium">{orderNumber(order)}</TableCell>
                  <TableCell>
                    <div className="leading-tight">
                      <div>{order.customer?.name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{order.customer?.phone || "—"}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusStyles[order.orderStatus] || ""}>
                      {order.orderStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>{paymentMethodLabels[order.paymentMethod] || order.paymentMethod}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(order.orderDate)}</TableCell>
                  <TableCell className="text-right font-medium">{formatBDT(order.totalPrice)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => setViewingSale(order)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => {
                        setEditingSale(order);
                        setEditingPaymentMethod(order.paymentMethod || "CASHON");
                        setEditingNote(order.note || "");
                      }}>
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="destructive" size="icon" className="h-9 w-9" onClick={() => setDeleteSale(order)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!offlineSalesQuery.isLoading && orders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    No offline sales found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div ref={loadMoreRef} className="h-8" />

      <Dialog open={createSaleOpen} onOpenChange={(open) => {
        setCreateSaleOpen(open);
        if (!open && !creatingSale) resetCreateSale();
      }}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-full max-h-[90vh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Create Offline Sale</DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr]">
            <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Customer Name</Label>
                  <Input value={createCustomer.name} onChange={(event) => updateCreateCustomer("name", event.target.value)} placeholder="Customer name" />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={createCustomer.phone} onChange={(event) => updateCreateCustomer("phone", event.target.value)} placeholder="01XXXXXXXXX" />
                </div>
                <div className="space-y-1.5">
                  <Label>Payment</Label>
                  <Select value={createPaymentMethod} onValueChange={setCreatePaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethodOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Address</Label>
                  <Input value={createCustomer.address} onChange={(event) => updateCreateCustomer("address", event.target.value)} placeholder="Street address" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Note</Label>
                  <Input value={createNote} onChange={(event) => setCreateNote(event.target.value)} placeholder="Optional sale note" />
                </div>
              </div>

              <div className="rounded-xl border bg-background p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatBDT(createSubtotal)}</span>
                </div>
                <div className="mt-2 flex justify-between border-t pt-2 text-base font-semibold">
                  <span>Total</span>
                  <span>{formatBDT(createTotal)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border bg-card p-4">
                <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
                  <div className="space-y-1.5">
                    <Label>Search Product</Label>
                    <Input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search product name..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Product</Label>
                    <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                      <SelectTrigger>
                        <SelectValue placeholder={productsQuery.isLoading ? "Loading..." : "Select product"} />
                      </SelectTrigger>
                      <SelectContent>
                        {productOptions.map((product) => (
                          <SelectItem key={product.id} value={String(product.id)}>
                            {product.name} - {formatBDT(product.price)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="opacity-0">Add</Label>
                    <Button type="button" onClick={addSelectedProductToSale} className="h-10 w-full">
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </div>

                {selectedProduct && (
                  <div className="mt-4 grid gap-3 grid-cols-1 rounded-xl border bg-muted/20 p-3 md:grid-cols-[72px_1fr_220px]">
                    <div className="h-20 w-16 overflow-hidden rounded-lg border bg-secondary">
                      {getProductImage(selectedProduct, selectedVariant?.image) ? (
                        <img src={getProductImage(selectedProduct, selectedVariant?.image)} alt={selectedProduct.name} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium">{selectedProduct.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Base stock: {selectedProduct.stockQty ?? 0} · Price: {formatBDT(selectedProduct.price)}
                      </div>
                      {selectedVariant && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Variant stock: {getVariantStock(selectedVariant)} · Variant price: {formatBDT(Number(selectedVariant.customerPrice || selectedProduct.price || 0))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Variant</Label>
                      <Select value={selectedVariantKey} onValueChange={setSelectedVariantKey} disabled={selectedProductVariants.length === 0}>
                        <SelectTrigger>
                          <SelectValue placeholder={selectedProductVariants.length === 0 ? "No variant" : "Select variant"} />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedProductVariants.map((variant, index) => {
                            const key = `${index}:${variant.size || ""}:${variant.color || ""}`;
                            return (
                              <SelectItem key={key} value={key}>
                                {[variant.size, variant.color].filter(Boolean).join(" / ") || "Default"} · {formatBDT(Number(variant.customerPrice || selectedProduct.price || 0))} · Stock {getVariantStock(variant)}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow className="bg-secondary/40">
                      <TableHead>Product</TableHead>
                      <TableHead>Variant</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {createItems.map((item) => (
                      <TableRow key={item.lineId}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-10 overflow-hidden rounded-lg border bg-secondary">
                              {item.image ? <img src={item.image} alt={item.name} className="h-full w-full object-cover" /> : null}
                            </div>
                            <div>
                              <div className="font-medium">{item.name}</div>
                              <div className="text-xs text-muted-foreground">Stock {item.stock ?? "N/A"}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{item.size}</TableCell>
                        <TableCell className="text-right">
                          <div className="ml-auto inline-flex items-center rounded-md border">
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateCreateItem(item.lineId, { quantity: Math.max(1, item.quantity - 1) })}>
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input type="number" min={1} value={item.quantity} onChange={(event) => updateCreateItem(item.lineId, { quantity: Math.max(1, Number(event.target.value || 1)) })} className="h-8 w-16 border-0 text-center shadow-none" />
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateCreateItem(item.lineId, { quantity: item.quantity + 1 })}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input type="number" min={0} value={item.price} onChange={(event) => updateCreateItem(item.lineId, { price: Math.max(0, Number(event.target.value || 0)) })} className="ml-auto h-9 w-28 text-right" />
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatBDT(item.price * item.quantity)}</TableCell>
                        <TableCell className="text-right">
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeCreateItem(item.lineId)} className="text-destructive hover:text-destructive">
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {createItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                          Search and add products to create a physical shop sale.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setCreateSaleOpen(false)} disabled={creatingSale}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={creatingSale}>
              {creatingSale ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating...
                </>
              ) : (
                <>Create Sale · {formatBDT(createTotal)}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingSale} onOpenChange={(open) => !open && setViewingSale(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {viewingSale && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">{orderNumber(viewingSale)}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer</div>
                  <div className="mt-1">{viewingSale.customer?.name || "—"}</div>
                  <div className="text-sm text-muted-foreground">{viewingSale.customer?.phone || ""}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</div>
                  <Badge variant="outline" className={`mt-1 ${statusStyles[viewingSale.orderStatus] || ""}`}>
                    {viewingSale.orderStatus}
                  </Badge>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address</div>
                  <div className="mt-1 text-sm">{viewingSale.customer?.address || "—"}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Items</div>
                  <div className="mt-2 overflow-x-auto rounded-xl border bg-card p-3">
                    <Table className="min-w-full">
                      <TableHeader>
                        <TableRow className="bg-secondary/40">
                          <TableHead>Product</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Array.isArray(viewingSale.items) &&
                          viewingSale.items.map((item, idx) => (
                            <TableRow key={idx} className="hover:bg-secondary/30">
                              <TableCell>{item.name || item.product || "—"}</TableCell>
                              <TableCell className="text-muted-foreground">{item.size || "—"}</TableCell>
                              <TableCell className="text-right">{item.quantity ?? item.qty ?? 1}</TableCell>
                              <TableCell className="text-right font-medium">{formatBDT(item.price ?? 0)}</TableCell>
                            </TableRow>
                          ))}
                        <TableRow className="bg-secondary/30">
                          <TableCell colSpan={3} className="text-right font-semibold">Total</TableCell>
                          <TableCell className="text-right font-semibold">{formatBDT(viewingSale.totalPrice)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
                {viewingSale.note && (
                  <div className="sm:col-span-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Note</div>
                    <div className="mt-1 text-sm">{viewingSale.note}</div>
                  </div>
                )}
                <div className="sm:col-span-2 text-sm text-muted-foreground">
                  Payment: {paymentMethodLabels[viewingSale.paymentMethod] || viewingSale.paymentMethod}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setViewingSale(null)}>
                  Close
                </Button>
                <Button onClick={() => {
                  if (viewingSale) {
                    setEditingSale(viewingSale);
                    setEditingPaymentMethod(viewingSale.paymentMethod || "CASHON");
                    setEditingNote(viewingSale.note || "");
                    setViewingSale(null);
                  }
                }}>
                  Edit
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingSale} onOpenChange={(open) => !open && setEditingSale(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {editingSale && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">Edit {orderNumber(editingSale)}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Customer</Label>
                  <Input value={editingSale.customer?.name || "—"} disabled className="bg-muted" />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={editingSale.customer?.phone || ""} disabled className="bg-muted" />
                </div>
                <div className="space-y-1.5">
                  <Label>Address</Label>
                  <Input value={editingSale.customer?.address || ""} disabled className="bg-muted" />
                </div>
                <div className="space-y-1.5">
                  <Label>Payment Method</Label>
                  <Select value={editingPaymentMethod} onValueChange={setEditingPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethodOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Note</Label>
                  <Input value={editingNote} onChange={(event) => setEditingNote(event.target.value)} />
                </div>
              </div>
              <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setEditingSale(null)} disabled={savingEdit}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} disabled={savingEdit}>
                  {savingEdit ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteSale} onOpenChange={(open) => !open && setDeleteSale(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteSale ? orderNumber(deleteSale) : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirmed}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deletingSale ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
