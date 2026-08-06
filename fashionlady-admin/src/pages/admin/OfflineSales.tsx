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
    Printer,
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

function handlePrint(o: OfflineSaleOrder, invoiceLogo: string) {
    const win = window.open("", "_blank", "width=900,height=1100");
    if (!win) return;

    const computedItemsTotal = itemsTotal(o);
    const computedDelivery = Number(o.deliveryCharge) || 0;
    const computedTotal = o.totalPrice || computedItemsTotal + computedDelivery;
    const customerAddress = [o.customer?.address, o.customer?.thana, o.customer?.district].filter(Boolean).join(", ");
    const compactInvoice = Array.isArray(o.items) && o.items.length <= 5;
    const rows = Array.isArray(o.items)
        ? o.items
            .map((i) => {
                const image = i.image ? `<img src="${i.image}" alt="${i.name || i.product || "Product"}" />` : "<div class=\"product-placeholder\">No Image</div>";
                return `
                    <tr>
                      <td>
                        <div class="product-cell">
                          <div class="product-thumb">${image}</div>
                          <div>
                            <div class="product-title">${i.name || i.product || "—"}</div>
                            ${i.size ? `<div class="product-meta">Size: ${i.size}</div>` : ""}
                          </div>
                        </div>
                      </td>
                      <td class="center">${i.quantity ?? i.qty ?? 1}</td>
                      <td class="right">${formatBDT(i.price ?? 0)}</td>
                      <td class="right">${formatBDT((i.price ?? 0) * (i.quantity ?? i.qty ?? 1))}</td>
                    </tr>`;
            })
            .join("")
        : "";

    win.document.write(`
      <html>
        <head>
          <title>Invoice ${orderNumber(o)}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            :root { color-scheme: light; }
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; background: #fff; }
            body { padding: 16px; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; }
            @page { size: A4 portrait; margin: 12mm; }
            .page { max-width: 900px; margin: 0 auto; }
            .brand { display: flex; justify-content: space-between; gap: 16px; align-items: center; margin-bottom: 22px; }
            .brand-logo img { width: 150px; height: auto; object-fit: contain; }
            .brand-title { font-size: 28px; font-weight: 800; letter-spacing: -0.04em; margin: 0; color: #d6336c; }
            .brand-tagline { margin: 8px 0 0; color: #6b7280; font-size: 14px; }
            .brand-info { text-align: right; font-size: 13px; color: #4b5563; line-height: 1.6; }
            .brand-info strong { color: #111827; }
            .divider { height: 1px; background: #e5e7eb; margin: 24px 0; border: none; }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
            .panel { padding: 18px 20px; border: 1px solid #e5e7eb; border-radius: 16px; background: #f9fafb; }
            .panel h2 { margin: 0 0 8px; font-size: 14px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.08em; }
            .panel p { margin: 0; color: #4b5563; line-height: 1.75; font-size: 14px; }
            .panel p span { display: block; color: #111827; font-weight: 600; }
            .invoice-meta { text-align: right; }
            .invoice-meta .value { font-size: 22px; font-weight: 800; color: #111827; margin-top: 6px; }
            .invoice-meta .label { font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.08em; }
            .table-wrap { overflow-x: auto; margin-top: 24px; }
            table { width: 100%; border-collapse: collapse; font-size: 14px; page-break-inside: auto; }
            thead th { text-align: left; padding: 14px 12px; color: #374151; font-weight: 700; border-bottom: 2px solid #e5e7eb; }
            tbody tr:nth-child(even) { background: #f8fafc; }
            td { padding: 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
            .product-cell { display: flex; gap: 12px; align-items: center; }
            .product-thumb { width: 64px; min-width: 64px; height: 64px; border-radius: 12px; overflow: hidden; background: #f3f4f6; display: grid; place-items: center; }
            .product-thumb img { width: 100%; height: 100%; object-fit: cover; }
            .product-placeholder { width: 100%; height: 100%; display: grid; place-items: center; font-size: 10px; color: #9ca3af; padding: 6px; text-align: center; }
            .product-title { font-weight: 700; color: #111827; }
            .product-meta { margin-top: 4px; color: #6b7280; font-size: 12px; }
            .center { text-align: center; }
            .right { text-align: right; }
            .totals { margin-top: 18px; max-width: 360px; margin-left: auto; }
            .totals .row { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; color: #4b5563; }
            .totals .row strong { color: #111827; }
            .totals .total { font-size: 18px; font-weight: 800; margin-top: 8px; }
            .note-box { margin-top: 30px; padding: 18px 20px; border-radius: 16px; border: 1px solid #e5e7eb; background: #fff; color: #4b5563; font-size: 13px; line-height: 1.7; }
            .signature-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 42px; }
            .signature-block { padding-top: 24px; border-top: 1px solid #e5e7eb; }
            .signature-line { height: 80px; border-bottom: 1px solid #d1d5db; margin-bottom: 8px; }
            .signature-label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
            .footer { margin-top: 42px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 18px; color: #6b7280; font-size: 12px; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            tfoot { display: table-row-group; }
            @media print {
              body { padding: 8px; }
              .page { margin: 0; width: auto; page-break-after: auto; }
              .compact { page-break-after: avoid; page-break-inside: avoid; }
              .brand { margin-bottom: 16px; }
              .panel { padding: 14px 16px; }
              thead th, td { padding: 10px; }
              .signature-row { gap: 16px; margin-top: 28px; }
              .totals { margin-top: 16px; }
              .footer { margin-top: 32px; }
              .brand, .grid-2, .signature-row, .footer, .table-wrap, .totals, .note-box { page-break-inside: avoid; }
            }
            @media (max-width: 720px) {
              .brand, .grid-2, .signature-row, .footer { grid-template-columns: 1fr; display: block; }
              .invoice-meta { text-align: left; margin-top: 16px; }
            }
          </style>
        </head>
        <body>
          <div class="page${compactInvoice ? " compact" : ""}">
            <header class="brand">
              <div class="brand-logo">
                <img src="${invoiceLogo}" alt="Fashion Feel Logo" onerror="this.src='${invoiceLogo}'" />
              </div>
              <div>
                <p class="brand-title">Fashion Feel</p>
                <p class="brand-tagline">Premium fashion for the modern lifestyle</p>
              </div>
              <div class="brand-info">
                <div><strong>Fashion Feel</strong></div>
                <div>123 Fashion Ave, Dhaka, Bangladesh</div>
                <div>hello@fashionfeel.com</div>
                <div>+880 1234 567890</div>
                <div>www.fashionfeel.com</div>
              </div>
            </header>

            <div class="grid-2">
              <section class="panel">
                <h2>Billing To</h2>
                <p><span>${o.customer?.name || "—"}</span>${o.customer?.phone ? `<br/>${o.customer.phone}` : ""}${customerAddress ? `<br/>${customerAddress}` : ""}</p>
              </section>
              <section class="panel invoice-meta">
                <div class="label">Invoice</div>
                <div class="value">${orderNumber(o)}</div>
                <div class="label" style="margin-top:18px;">Date</div>
                <div>${formatDate(o.orderDate)}</div>
                <div class="label" style="margin-top:18px;">Payment</div>
                <div>${o.paymentMethod === "CASHON" ? "Cash on Delivery" : o.paymentMethod}</div>
                <div class="label" style="margin-top:18px;">Status</div>
                <div>${o.orderStatus}</div>
              </section>
            </div>

            <hr class="divider" />

            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th class="center">Qty</th>
                    <th class="right">Unit Price</th>
                    <th class="right">Total</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>

            <div class="totals">
              <div class="row"><span>Subtotal</span><strong>${formatBDT(computedItemsTotal)}</strong></div>
              <div class="row"><span>Delivery Charge</span><strong>${computedDelivery ? formatBDT(computedDelivery) : "Free"}</strong></div>
              <div class="row total"><span>Total Amount</span><strong>${formatBDT(computedTotal)}</strong></div>
            </div>

            ${o.note ? `<div class="note-box"><strong>Order Note:</strong> ${o.note}</div>` : ""}

            <div class="signature-row">
              <div class="signature-block">
                <div class="signature-line"></div>
                <div class="signature-label">Customer Signature</div>
              </div>
              <div class="signature-block">
                <div class="signature-line"></div>
                <div class="signature-label">Authorized Signature</div>
              </div>
            </div>

            <footer class="footer">
              <div>Thank you for shopping with Fashion Feel.</div>
              <div>Please retain this invoice for your records.</div>
            </footer>
          </div>
          <script>
            const images = Array.from(document.images);
            const loadPromises = images.map(img => {
              if (img.complete) return Promise.resolve();
              return new Promise(resolve => {
                img.addEventListener('load', resolve);
                img.addEventListener('error', resolve);
              });
            });
            Promise.all(loadPromises).then(() => {
              window.print();
              setTimeout(() => window.close(), 300);
            });
          </script>
        </body>
      </html>
    `);

    win.document.close();
}

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

    const invoiceLogo = new URL("/fasionfeel-logo.jpg", window.location.origin).href;
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
                                            <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => handlePrint(order, invoiceLogo)}>
                                                <Printer className="h-4 w-4" />
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
                                                    <TableHead>Image</TableHead>
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
                                                            <TableCell>
                                                                <div className="h-12 w-12 overflow-hidden rounded-lg border bg-secondary">
                                                                    {item.image ? (
                                                                        <img
                                                                            src={item.image}
                                                                            alt={item.name || item.product || "Product"}
                                                                            className="h-full w-full object-cover"
                                                                        />
                                                                    ) : null}
                                                                </div>
                                                            </TableCell>
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
                                <Button variant="outline" onClick={() => viewingSale && handlePrint(viewingSale, invoiceLogo)}>
                                    <Printer className="mr-2 h-4 w-4" />
                                    Print
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
