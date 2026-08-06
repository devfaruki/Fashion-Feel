import { useState, useEffect, useRef } from "react";
import { useInfiniteQuery, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Trash2, Printer, Search, RefreshCw, Package, ShieldAlert, Truck, Loader2, Plus, Minus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { getErrorMessage } from "@/lib/utils";
import { api, resolveAssetUrl } from "@/lib/api";
import type { Product } from "@/types/store";
import {
  BANGLADESH_DISTRICTS,
  DISTRICT_UPAZILAS,
  getDeliveryChargeForDistrict,
} from "@/lib/bangladesh-address";

// Server-side order status values (uppercase enum from Prisma)
type ServerOrderStatus = "PENDING" | "SHIPPED" | "DELIVERED" | "CANCELLED";

const STATUSES: ServerOrderStatus[] = [
  "PENDING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

const statusStyles: Record<string, string> = {
  PENDING: "bg-secondary text-secondary-foreground border-border",
  SHIPPED: "bg-blue-100 text-blue-700 border-blue-200",
  DELIVERED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-destructive/10 text-destructive border-destructive/20",
};

type CourierData = {
  name: string;
  logo: string;
  total_parcel: number;
  success_parcel: number | string;
  cancelled_parcel: number | string;
  success_ratio: number;
};

type FraudCheckResponse = {
  status: string;
  data: { [key: string]: CourierData };
};

type FraudSummary = {
  successRatio: number | null;
  totalParcels: number;
  successParcels: number;
  cancelledParcels: number;
};

type CourierStatusResponse = {
  status?: string | number;
  delivery_status?: string;
  data?: {
    delivery_status?: string;
  };
};

interface CourierDetails {
  courierName?: string;
  consignment_id?: string;
  invoice?: string;
  tracking_code?: string;
}

interface OrderItem {
  productId?: number;
  name?: string;
  product?: string;
  price?: number;
  quantity?: number;
  qty?: number;
  size?: string;
  image?: string;
  variantSize?: string;
  variantColor?: string;
}

type CreateOrderItem = {
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

type ProductVariant = NonNullable<NonNullable<Product["variants"]>[number]>;

interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
  district?: string;
  thana?: string;
  deliveryCharge?: number;
}

interface Order {
  id: number;
  customerId: number;
  customer: Customer;
  totalPrice: number;
  deliveryCharge: number;
  orderStatus: ServerOrderStatus;
  orderDate: string;
  paymentMethod: string;
  items: OrderItem[];
  note?: string;
  courierDetails?: CourierDetails;
}

type CourierLookupType = "cid" | "invoice" | "trackingcode";

interface CourierLookup {
  key: string;
  type: CourierLookupType;
}

const getCourierLookup = (order: Order): CourierLookup | null => {
  if (!order.courierDetails) return null;
  if (order.courierDetails.consignment_id) {
    return { key: String(order.courierDetails.consignment_id), type: "cid" };
  }
  if (order.courierDetails.invoice) {
    return { key: String(order.courierDetails.invoice), type: "invoice" };
  }
  if (order.courierDetails.tracking_code) {
    return { key: String(order.courierDetails.tracking_code), type: "trackingcode" };
  }
  return null;
};

const getProductImage = (product?: Product | null, variantImage?: string) => {
  const image = variantImage || product?.images?.[0] || "";
  return resolveAssetUrl(image) || "";
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

export default function Orders() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const [viewing, setViewing] = useState<Order | null>(null);
  const [editing, setEditing] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState<Order | null>(null);
  const [fraudOrder, setFraudOrder] = useState<Order | null>(null);
  const [courierInfoOrder, setCourierInfoOrder] = useState<Order | null>(null);
  const [addingCourierId, setAddingCourierId] = useState<number | null>(null);
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [createCustomer, setCreateCustomer] = useState({
    name: "",
    phone: "",
    address: "",
    district: "",
    thana: "",
  });
  const [createPaymentMethod, setCreatePaymentMethod] = useState("CASHON");
  const [createDeliveryCharge, setCreateDeliveryCharge] = useState(0);
  const [createNote, setCreateNote] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const debouncedProductSearch = useDebounce(productSearch, 300);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVariantKey, setSelectedVariantKey] = useState("");
  const [createItems, setCreateItems] = useState<CreateOrderItem[]>([]);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const ordersQuery = useInfiniteQuery({
    queryKey: ["admin-orders", debouncedSearch],
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get("/order/all-order", {
        params: { page: pageParam, limit: 10, search: debouncedSearch },
      });
      return data.data as {
        orders: Order[];
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

  const orders = ordersQuery.data?.pages.flatMap((p) => p.orders) ?? [];
  const fraudPhones = Array.from(new Set(orders.map((order) => order.customer?.phone).filter(Boolean)));
  const courierLookups = Array.from(
    new Map(
      orders
        .map((order) => {
          const lookup = getCourierLookup(order);
          return lookup ? [lookup.key, lookup] : null;
        })
        .filter((item): item is [string, CourierLookup] => Boolean(item)),
    ).values(),
  );

  const fraudChecks = useQueries({
    queries: fraudPhones.map((phone) => ({
      queryKey: ["fraudCheckRow", phone],
      queryFn: async () => {
        const response = await api.get(`/courier/check-fraud?phone=${phone}`);
        return response.data as FraudCheckResponse;
      },
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 10,
      enabled: Boolean(phone),
    })),
  });

  const getCourierStatusPath = (lookup: CourierLookup) => {
    return `/courier/status/${lookup.type}/${encodeURIComponent(lookup.key)}`;
  };

  const courierStatuses = useQueries({
    queries: courierLookups.map((lookup) => ({
      queryKey: ["courier-status", lookup.type, lookup.key],
      queryFn: async () => {
        const path = getCourierStatusPath(lookup);
        try {
          const response = await api.get(path);
          return response.data as CourierStatusResponse;
        } catch (error: any) {
          if (lookup.type === "cid" && error?.response?.status === 404) {
            const fallbackResponse = await api.get(`/courier/status/${encodeURIComponent(lookup.key)}`);
            return fallbackResponse.data as CourierStatusResponse;
          }
          throw error;
        }
      },
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60,
      enabled: Boolean(lookup.key),
    })),
  });

  const fraudByPhone = new Map(
    fraudPhones.map((phone, index) => [phone, fraudChecks[index]]),
  );
  const courierStatusByKey = new Map(
    courierLookups.map((lookup, index) => [lookup.key, courierStatuses[index]]),
  );

  const {
    data: fraudCheckData,
    isLoading: fraudCheckLoading,
    isError: fraudCheckError,
    error: fraudCheckErrorData,
  } = useQuery({
    queryKey: ["fraudCheck", fraudOrder?.customer?.phone],
    queryFn: async () => {
      const targetUrl = `/courier/check-fraud?phone=${fraudOrder?.customer?.phone}`;
      const response = await api.get(targetUrl);
      return response.data as FraudCheckResponse;
    },
    retry: 2,
    refetchOnWindowFocus: false,
    enabled: !!fraudOrder && !!fraudOrder?.customer?.phone,
  });

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
    enabled: createOrderOpen,
  });

  const productOptions = productsQuery.data ?? [];
  const selectedProduct = productOptions.find((product) => String(product.id) === selectedProductId) ?? null;
  const selectedProductVariants = getActiveProductVariants(selectedProduct);
  const selectedVariant = selectedProductVariants.find((variant, index) => {
    const key = `${index}:${variant.size || ""}:${variant.color || ""}`;
    return key === selectedVariantKey;
  });
  const createSubtotal = createItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const createTotal = createSubtotal + Number(createDeliveryCharge || 0);
  const createDistrictOptions = [...BANGLADESH_DISTRICTS];
  const createThanaOptions = createCustomer.district
    ? DISTRICT_UPAZILAS[createCustomer.district] || []
    : [];

  useEffect(() => {
    setSelectedVariantKey("");
  }, [selectedProductId]);

  useEffect(() => {
    const charge = getDeliveryChargeForDistrict(createCustomer.district, createCustomer.thana);
    setCreateDeliveryCharge(charge ?? 0);
  }, [createCustomer.district, createCustomer.thana]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          ordersQuery.hasNextPage &&
          !ordersQuery.isFetchingNextPage
        ) {
          ordersQuery.fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [ordersQuery]);

  const handleAddToCourier = async (order: Order, force = false) => {
    if (order.courierDetails && !force) {
      const res = window.confirm(
        "Order is already added to courier. Do you want to add/update this order in the courier again?"
      );
      if (!res) return;
    }

    const randomInvoiceId = Math.floor(Math.random() * 1000000) + 100000;
    const data = {
      invoice: randomInvoiceId.toString(),
      recipient_name: order.customer?.name,
      recipient_phone: order.customer?.phone,
      recipient_address: [
        order.customer?.address,
        order.customer?.thana,
        order.customer?.district,
      ]
        .filter(Boolean)
        .join(", "),
      cod_amount: order.totalPrice + order.deliveryCharge,
    };

    try {
      setAddingCourierId(order.id);
      const response = await api.post("/courier/create-order", data);

      const orderUpdateData = {
        courierName: "Steadfast",
        consignment_id: response.data?.consignment?.consignment_id,
        invoice: response.data?.consignment?.invoice,
        tracking_code: response.data?.consignment?.tracking_code,
      };

      if (response.status === 200) {
        await api.patch(`/order/update-order/${order.id}`, { courierDetails: orderUpdateData });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["admin-orders"] }),
          queryClient.invalidateQueries({ queryKey: ["courier-status"] }),
        ]);
        toast({
          title: "Success",
          description: response.data?.message || "Order added to courier successfully.",
        });
      }
    } catch (error: unknown) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: getErrorMessage(error) || "Failed to add to courier.",
        variant: "destructive",
      });
    } finally {
      setAddingCourierId(null);
    }
  };

  const resetCreateOrder = () => {
    setCreateCustomer({ name: "", phone: "", address: "", district: "", thana: "" });
    setCreatePaymentMethod("CASHON");
    setCreateDeliveryCharge(0);
    setCreateNote("");
    setProductSearch("");
    setSelectedProductId("");
    setSelectedVariantKey("");
    setCreateItems([]);
  };

  const updateCreateCustomer = (key: keyof typeof createCustomer, value: string) => {
    setCreateCustomer((current) => ({
      ...current,
      [key]: value,
      ...(key === "district" ? { thana: "" } : {}),
    }));
  };

  const addSelectedProductToOrder = () => {
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

  const updateCreateItem = (lineId: string, patch: Partial<CreateOrderItem>) => {
    setCreateItems((current) =>
      current.map((item) => (item.lineId === lineId ? { ...item, ...patch } : item)),
    );
  };

  const removeCreateItem = (lineId: string) => {
    setCreateItems((current) => current.filter((item) => item.lineId !== lineId));
  };

  const handleCreateOrderSubmit = async () => {
    if (!createCustomer.name.trim() || !createCustomer.phone.trim() || !createCustomer.address.trim()) {
      toast({
        title: "Customer information required",
        description: "Name, phone, and address are required.",
        variant: "destructive",
      });
      return;
    }
    if (!createCustomer.district.trim() || !createCustomer.thana.trim()) {
      toast({
        title: "Delivery area required",
        description: "District and thana/upazila are required.",
        variant: "destructive",
      });
      return;
    }
    if (createItems.length === 0) {
      toast({
        title: "Add at least one product",
        variant: "destructive",
      });
      return;
    }

    const invalidItem = createItems.find((item) => item.quantity < 1 || item.price < 0);
    if (invalidItem) {
      toast({
        title: "Invalid item quantity or price",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreatingOrder(true);
      await api.post("/order/add-order", {
        name: createCustomer.name.trim(),
        phone: createCustomer.phone.trim(),
        address: createCustomer.address.trim(),
        district: createCustomer.district.trim(),
        thana: createCustomer.thana.trim(),
        deliveryCharge: Number(createDeliveryCharge || 0),
        totalPrice: createTotal,
        paymentMethod: createPaymentMethod,
        note: createNote.trim() || null,
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

      toast({ title: "Order created", description: "Custom order has been added." });
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setCreateOrderOpen(false);
      resetCreateOrder();
    } catch (error: unknown) {
      toast({
        title: "Failed to create order",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setCreatingOrder(false);
    }
  };

  const formatBDT = (amount: number) =>
    new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency: "BDT",
      maximumFractionDigits: 0,
    }).format(amount);

  const orderNumber = (o: Order) =>
    `FL-${String(o.id).padStart(4, "0")}`;

  const itemsTotal = (o: Order) =>
    Array.isArray(o.items)
      ? o.items.reduce(
        (sum, i) => sum + (i.price ?? 0) * (i.quantity ?? i.qty ?? 1),
        0,
      )
      : 0;

  const formatDate = (d: string) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-BD", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const summarizeFraud = (data?: FraudCheckResponse): FraudSummary => {
    const couriers = Object.values(data?.data || {});
    if (data?.status !== "success" || couriers.length === 0) {
      return { successRatio: null, totalParcels: 0, successParcels: 0, cancelledParcels: 0 };
    }

    const totals = couriers.reduce(
      (acc, courier) => {
        acc.totalParcels += Number(courier.total_parcel) || 0;
        acc.successParcels += Number(courier.success_parcel) || 0;
        acc.cancelledParcels += Number(courier.cancelled_parcel) || 0;
        return acc;
      },
      { totalParcels: 0, successParcels: 0, cancelledParcels: 0 },
    );

    if (totals.totalParcels > 0) {
      return {
        ...totals,
        successRatio: (totals.successParcels / totals.totalParcels) * 100,
      };
    }

    const ratios = couriers
      .map((courier) => Number(courier.success_ratio))
      .filter((ratio) => Number.isFinite(ratio));

    return {
      ...totals,
      successRatio: ratios.length ? ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length : null,
    };
  };

  const fraudRiskLabel = (ratio: number | null) => {
    if (ratio === null) return "No Entry";
    if (ratio < 50) return "High Risk";
    if (ratio < 75) return "Medium Risk";
    return "Low Risk";
  };

  const fraudBadgeClass = (ratio: number | null) => {
    if (ratio === null) return "bg-muted text-muted-foreground border-border";
    if (ratio < 50) return "bg-red-100 text-red-700 border-red-200";
    if (ratio < 75) return "bg-amber-100 text-amber-700 border-amber-200";
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
  };

  const normalizeCourierStatus = (data?: CourierStatusResponse) => {
    const rawStatus = String(data?.delivery_status || data?.data?.delivery_status || "").trim().toLowerCase();
    const normalized = rawStatus
      .replace(/\s+/g, "_")
      .replace(/[-/]+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

    return normalized;
  };

  const courierStatusLabel = (status: string) => {
    const normalized = status.trim();

    switch (normalized) {
      case "in_review":
        return "In Review";
      case "pending":
        return "Pending";
      case "delivered":
      case "delivered_approval_pending":
        return "Delivered";
      case "partial_delivered":
      case "partial_delivered_approval_pending":
        return "Partial Delivered";
      case "cancelled":
      case "cancelled_approval_pending":
        return "Cancelled";
      case "hold":
        return "On Hold";
      case "unknown":
      case "unknown_approval_pending":
        return "Deleted";
      default:
        return normalized
          ? normalized
            .replace(/_/g, " ")
            .replace(/\b\w/g, (match) => match.toUpperCase())
          : "No Entry";
    }
  };

  const courierStatusClass = (status: string) => {
    switch (status) {
      case "delivered":
      case "partial_delivered":
      case "delivered_approval_pending":
      case "partial_delivered_approval_pending":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "cancelled":
      case "unknown":
      case "cancelled_approval_pending":
      case "unknown_approval_pending":
        return "bg-red-100 text-red-700 border-red-200";
      case "pending":
      case "in_review":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "hold":
        return "bg-sky-100 text-sky-700 border-sky-200";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  async function handleStatusUpdate(orderId: number, newStatus: ServerOrderStatus) {
    try {
      await api.patch(`/order/update-order/${orderId}`, {
        orderStatus: newStatus,
      });
      toast({ title: "Order updated", description: `Status changed to ${newStatus}.` });
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setEditing(null);
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(err) || "Failed to update order.",
        variant: "destructive",
      });
    }
  }

  async function handleDelete(o: Order) {
    try {
      await api.delete(`/order/delete-order/${o.id}`);
      toast({ title: "Order deleted", description: `${orderNumber(o)} removed.` });
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(err) || "Failed to delete order.",
        variant: "destructive",
      });
    }
    setDeleting(null);
  }

  function handlePrint(o: Order) {
    const win = window.open("", "_blank", "width=720,height=900");
    if (!win) return;

    const computedItemsTotal = itemsTotal(o);
    const computedDelivery = Number(o.deliveryCharge) || 0;
    const computedTotal = o.totalPrice || computedItemsTotal + computedDelivery;
    const rows = Array.isArray(o.items)
      ? o.items
        .map(
          (i) =>
            `<tr>
              <td>${i.name || i.product || "—"}${i.size ? ` <span class="muted">(${i.size})</span>` : ""}</td>
              <td>${i.quantity ?? i.qty ?? 1}</td>
              <td class="right">${formatBDT(i.price ?? 0)}</td>
              <td class="right">${formatBDT((i.price ?? 0) * (i.quantity ?? i.qty ?? 1))}</td>
            </tr>`,
        )
        .join("")
      : "";

    win.document.write(`
      <html><head><title>Invoice ${orderNumber(o)}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body{font-family:Inter,sans-serif;padding:40px;color:#1a1a1a}
        h1{font-family:Georgia,serif;color:#d6336c;margin:0 0 4px}
        .table-wrap{overflow-x:auto}
        table{min-width:560px;width:100%;border-collapse:collapse;margin-top:24px}
        th,td{padding:10px;border-bottom:1px solid #eee;text-align:left}
        .right{text-align:right}.muted{color:#777;font-size:12px}
        @media (max-width: 640px){body{padding:16px}table{min-width:480px}}
      </style></head><body>
      <h1>Fasion Feel</h1>
      <div class="muted">Invoice ${orderNumber(o)} · ${formatDate(o.orderDate)}</div>
      <p><strong>${o.customer?.name || "—"}</strong><br/>${o.customer?.phone || ""}<br/>${[o.customer?.address, o.customer?.thana, o.customer?.district].filter(Boolean).join(", ")}</p>
      <div class="table-wrap">
        <table><thead><tr><th>Item</th><th>Qty</th><th class="right">Price</th><th class="right">Line total</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr><td colspan="3"><strong>Subtotal</strong></td><td class="right"><strong>${formatBDT(computedItemsTotal)}</strong></td></tr>
          <tr><td colspan="3"><strong>Delivery</strong></td><td class="right"><strong>${computedDelivery ? formatBDT(computedDelivery) : "Free"}</strong></td></tr>
          <tr><td colspan="3"><strong>Total</strong></td><td class="right"><strong>${formatBDT(computedTotal)}</strong></td></tr>
        </tfoot>
        </table>
      </div>
      <p class="muted">Payment: ${o.paymentMethod === "CASHON" ? "Cash on Delivery" : o.paymentMethod}</p>
      <script>window.print()</script>
      </body></html>`);
    win.document.close();
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-3 p-4 shadow-soft md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by order #, customer, status…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            className="h-10 rounded-xl pl-9"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={() => setCreateOrderOpen(true)}
            className="h-10 rounded-xl"
          >
            <Plus className="mr-2 h-4 w-4" /> Create Order
          </Button>
          <Button
            onClick={() => ordersQuery.refetch()}
            variant="outline"
            className="h-10 rounded-xl"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden shadow-soft text-nowrap">
        <div className="overflow-x-auto">
          <Table className="min-w-[1060px]">
            <TableHeader>
              <TableRow className="bg-secondary/40">
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Success Rate</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Courier Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordersQuery.isLoading &&
                orders.length === 0 &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-6 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-28 ml-auto" /></TableCell>
                  </TableRow>
                ))}
              {orders.map((o, idx) => {
                const fraudQuery = fraudByPhone.get(o.customer?.phone || "");
                const fraudSummary = summarizeFraud(fraudQuery?.data);
                const courierLookup = getCourierLookup(o);
                const courierQuery = courierLookup
                  ? courierStatusByKey.get(courierLookup.key) ?? null
                  : null;
                const courierStatus = normalizeCourierStatus(courierQuery?.data);

                return (
                  <TableRow key={o.id} className="hover:bg-secondary/30">
                    <TableCell className="text-center text-muted-foreground text-sm">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="font-medium">
                      {orderNumber(o)}
                    </TableCell>
                    <TableCell>
                      <div className="leading-tight">
                        <div>{o.customer?.name || "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {o.customer?.phone || ""}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[220px]">
                          {[o.customer?.thana, o.customer?.district].filter(Boolean).join(" · ") || ""}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setFraudOrder(o)}
                        className="text-left"
                        title="Open fraud check details"
                      >
                        {fraudQuery?.isLoading ? (
                          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Checking
                          </span>
                        ) : fraudQuery?.isError ? (
                          <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
                            Error
                          </Badge>
                        ) : (
                          <div className="leading-tight">
                            <Badge variant="outline" className={fraudBadgeClass(fraudSummary.successRatio)}>
                              {fraudSummary.successRatio === null
                                ? "No Entry"
                                : `${fraudSummary.successRatio.toFixed(1)}%`}
                            </Badge>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {fraudRiskLabel(fraudSummary.successRatio)}
                            </div>
                          </div>
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(o.orderDate)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusStyles[o.orderStatus] || ""}
                      >
                        {o.orderStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {courierLookup ? (
                        courierQuery?.isLoading ? (
                          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Loading
                          </span>
                        ) : (
                          <Badge variant="outline" className={courierStatusClass(courierStatus)}>
                            {courierQuery?.isError ? "Status Error" : courierStatusLabel(courierStatus)}
                          </Badge>
                        )
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                          No Entry
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatBDT(o.totalPrice)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setViewing(o)}
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handlePrint(o)}
                          title="Invoice"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditing(o)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setFraudOrder(o)}
                          title="Fraud Check"
                        >
                          <ShieldAlert className="h-4 w-4 text-orange-500" />
                        </Button>
                        {o.courierDetails ? (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setCourierInfoOrder(o)}
                              title="Courier Info"
                            >
                              <Package className="h-4 w-4 text-blue-500" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleAddToCourier(o, true)}
                              disabled={addingCourierId === o.id}
                              title="Re-send to Courier"
                            >
                              {addingCourierId === o.id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-green-500" />
                              ) : (
                                <RefreshCw className="h-4 w-4 text-slate-500" />
                              )}
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleAddToCourier(o)}
                            disabled={addingCourierId === o.id}
                            title="Send to Courier"
                          >
                            {addingCourierId === o.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-green-500" />
                            ) : (
                              <Truck className="h-4 w-4 text-green-500" />
                            )}
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleting(o)}
                          title="Delete"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!ordersQuery.isLoading && orders.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="py-12 text-center text-muted-foreground"
                  >
                    No orders found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

      </Card>

      <div ref={loadMoreRef} className="h-8" />

      {/* Create order modal */}
      <Dialog open={createOrderOpen} onOpenChange={(open) => {
        setCreateOrderOpen(open);
        if (!open && !creatingOrder) resetCreateOrder();
      }}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-full max-h-[90vh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Create Custom Order</DialogTitle>
            <DialogDescription>
              Search products, choose variants, adjust quantity and price, then create an order manually.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr]">
            <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Customer Name</Label>
                  <Input
                    value={createCustomer.name}
                    onChange={(event) => updateCreateCustomer("name", event.target.value)}
                    placeholder="Customer name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input
                    value={createCustomer.phone}
                    onChange={(event) => updateCreateCustomer("phone", event.target.value)}
                    placeholder="01XXXXXXXXX"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Payment</Label>
                  <Select value={createPaymentMethod} onValueChange={setCreatePaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASHON">Cash on Delivery</SelectItem>
                      <SelectItem value="BKASH">Bkash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Address</Label>
                  <Input
                    value={createCustomer.address}
                    onChange={(event) => updateCreateCustomer("address", event.target.value)}
                    placeholder="Street address"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>District</Label>
                  <Select
                    value={createCustomer.district}
                    onValueChange={(value) => updateCreateCustomer("district", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select district" />
                    </SelectTrigger>
                    <SelectContent>
                      {createDistrictOptions.map((district) => (
                        <SelectItem key={district} value={district}>
                          {district}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Thana / Upazila</Label>
                  <Select
                    value={createCustomer.thana}
                    onValueChange={(value) => updateCreateCustomer("thana", value)}
                    disabled={!createCustomer.district || createThanaOptions.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          !createCustomer.district
                            ? "Select district first"
                            : "Select thana / upazila"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {createThanaOptions.map((thana) => (
                        <SelectItem key={thana} value={thana}>
                          {thana}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Delivery Charge</Label>
                  <Input
                    type="number"
                    min={0}
                    value={createDeliveryCharge}
                    readOnly
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Auto calculated: Dhaka city BDT 70, Dhaka outer and outside Dhaka BDT 130.
                  </p>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Note</Label>
                  <Input
                    value={createNote}
                    onChange={(event) => setCreateNote(event.target.value)}
                    placeholder="Optional order note"
                  />
                </div>
              </div>

              <div className="rounded-xl border bg-background p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatBDT(createSubtotal)}</span>
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="text-muted-foreground">Delivery</span>
                  <span className="font-medium">{formatBDT(Number(createDeliveryCharge || 0))}</span>
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
                    <Input
                      value={productSearch}
                      onChange={(event) => setProductSearch(event.target.value)}
                      placeholder="Search product name..."
                    />
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
                    <Button type="button" onClick={addSelectedProductToOrder} className="h-10 w-full">
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </div>

                {selectedProduct && (
                  <div className="mt-4 grid gap-3 grid-cols-1 rounded-xl border bg-muted/20 p-3 md:grid-cols-[72px_1fr_220px]">
                    <div className="h-20 w-16 overflow-hidden rounded-lg border bg-secondary">
                      {getProductImage(selectedProduct, selectedVariant?.image) ? (
                        <img
                          src={getProductImage(selectedProduct, selectedVariant?.image)}
                          alt={selectedProduct.name}
                          className="h-full w-full object-cover"
                        />
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
                      <Select
                        value={selectedVariantKey}
                        onValueChange={setSelectedVariantKey}
                        disabled={selectedProductVariants.length === 0}
                      >
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
                      <TableHead className="text-right">Line Total</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {createItems.map((item) => (
                      <TableRow key={item.lineId}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-10 overflow-hidden rounded-lg border bg-secondary">
                              {item.image ? (
                                <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                              ) : null}
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
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateCreateItem(item.lineId, { quantity: Math.max(1, item.quantity - 1) })}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(event) => updateCreateItem(item.lineId, { quantity: Math.max(1, Number(event.target.value || 1)) })}
                              className="h-8 w-16 border-0 text-center shadow-none"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateCreateItem(item.lineId, { quantity: item.quantity + 1 })}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            value={item.price}
                            onChange={(event) => updateCreateItem(item.lineId, { price: Math.max(0, Number(event.target.value || 0)) })}
                            className="ml-auto h-9 w-28 text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatBDT(item.price * item.quantity)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeCreateItem(item.lineId)}
                            className="text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {createItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                          Search and add products to start a custom order.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOrderOpen(false)}
              disabled={creatingOrder}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateOrderSubmit} disabled={creatingOrder}>
              {creatingOrder ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>Create Order · {formatBDT(createTotal)}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View modal */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">
                  {orderNumber(viewing)}
                </DialogTitle>
                <DialogDescription>
                  Placed {formatDate(viewing.orderDate)}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Customer
                  </div>
                  <div className="mt-1">{viewing.customer?.name || "—"}</div>
                  <div className="text-sm text-muted-foreground">
                    {viewing.customer?.phone || ""}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </div>
                  <Badge
                    variant="outline"
                    className={`mt-1 ${statusStyles[viewing.orderStatus] || ""}`}
                  >
                    {viewing.orderStatus}
                  </Badge>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Shipping Address
                  </div>
                  <div className="mt-1 text-sm">
                    {[viewing.customer?.address, viewing.customer?.thana, viewing.customer?.district]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Items
                  </div>
                  {/* Mobile items view */}
                  <div className="mt-2 space-y-3 sm:hidden">
                    {Array.isArray(viewing.items) &&
                      viewing.items.map((i, idx) => (
                        <div key={idx} className="rounded-xl border bg-card p-3">
                          <div className="flex items-start gap-3">
                            {i.image ? (
                              <img
                                src={i.image}
                                alt={i.name || i.product || "Product"}
                                className="h-12 w-12 rounded-lg object-cover bg-secondary/50"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0">
                                <Package className="h-6 w-6 text-muted-foreground/50" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="font-medium leading-tight">
                                {i.name || i.product || "—"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {i.size || "—"}
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <div className="font-medium">
                                {formatBDT(i.price ?? 0)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Qty {i.quantity ?? i.qty ?? 1}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    <div className="rounded-xl border bg-secondary/30 p-3 text-sm">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span className="font-medium">
                          {formatBDT(itemsTotal(viewing))}
                        </span>
                      </div>
                      <div className="mt-2 flex justify-between">
                        <span>Delivery charge</span>
                        <span className="font-medium">
                          {viewing.deliveryCharge
                            ? formatBDT(viewing.deliveryCharge)
                            : "Free"}
                        </span>
                      </div>
                      <div className="mt-2 flex justify-between font-semibold">
                        <span>Total</span>
                        <span>{formatBDT(viewing.totalPrice)}</span>
                      </div>
                    </div>
                  </div>
                  {/* Desktop items table */}
                  <div className="mt-2 hidden overflow-x-auto rounded-xl border sm:block">
                    <Table className="min-w-[500px]">
                      <TableHeader>
                        <TableRow className="bg-secondary/40">
                          <TableHead className="w-16">Image</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Array.isArray(viewing.items) &&
                          viewing.items.map((i, idx) => (
                            <TableRow
                              key={idx}
                              className="hover:bg-secondary/30"
                            >
                              <TableCell>
                                {i.image ? (
                                  <img
                                    src={i.image}
                                    alt={i.name || i.product || "Product"}
                                    className="h-10 w-10 rounded-lg object-cover bg-secondary/50"
                                  />
                                ) : (
                                  <div className="h-10 w-10 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0">
                                    <Package className="h-5 w-5 text-muted-foreground/50" />
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">
                                  {i.name || i.product || "—"}
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {i.size || "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                {i.quantity ?? i.qty ?? 1}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatBDT(i.price ?? 0)}
                              </TableCell>
                            </TableRow>
                          ))}
                        <TableRow className="bg-secondary/30">
                          <TableCell
                            colSpan={4}
                            className="text-right font-medium"
                          >
                            Subtotal
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatBDT(itemsTotal(viewing))}
                          </TableCell>
                        </TableRow>
                        <TableRow className="bg-secondary/30">
                          <TableCell
                            colSpan={4}
                            className="text-right font-medium"
                          >
                            Delivery Charge
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {viewing.deliveryCharge
                              ? formatBDT(viewing.deliveryCharge)
                              : "Free"}
                          </TableCell>
                        </TableRow>
                        <TableRow className="bg-secondary/40">
                          <TableCell
                            colSpan={4}
                            className="text-right text-base font-semibold"
                          >
                            Total
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatBDT(viewing.totalPrice)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
                {viewing.note && (
                  <div className="sm:col-span-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Note
                    </div>
                    <div className="mt-1 text-sm">{viewing.note}</div>
                  </div>
                )}
                <div className="sm:col-span-2 text-sm text-muted-foreground">
                  Payment:{" "}
                  {viewing.paymentMethod === "CASHON"
                    ? "Cash on Delivery"
                    : viewing.paymentMethod}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => handlePrint(viewing)}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print invoice
                </Button>
                <Button
                  onClick={() => {
                    setEditing(viewing);
                    setViewing(null);
                  }}
                >
                  Edit
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit status modal */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">
                  Edit {orderNumber(editing)}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Customer</Label>
                  <Input
                    value={editing.customer?.name || "—"}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input
                    value={editing.customer?.phone || ""}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Address</Label>
                  <Input
                    value={editing.customer?.address || ""}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>District</Label>
                    <Input
                      value={editing.customer?.district || ""}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Thana / Upazila</Label>
                    <Input
                      value={editing.customer?.thana || ""}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Order Status</Label>
                  <Select
                    defaultValue={editing.orderStatus}
                    onValueChange={(val) =>
                      handleStatusUpdate(editing.id, val as ServerOrderStatus)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Total</Label>
                    <Input
                      value={formatBDT(editing.totalPrice)}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Delivery Charge</Label>
                    <Input
                      value={formatBDT(editing.deliveryCharge)}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Payment Method</Label>
                  <Input
                    value={
                      editing.paymentMethod === "CASHON"
                        ? "Cash on Delivery"
                        : editing.paymentMethod
                    }
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setEditing(null)}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleting ? orderNumber(deleting) : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && handleDelete(deleting)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Courier Info Modal */}
      <Dialog open={!!courierInfoOrder} onOpenChange={(o) => !o && setCourierInfoOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Courier Info</DialogTitle>
          </DialogHeader>
          {courierInfoOrder && (
            <div className="w-full">
              {(() => {
                const courierLookup = getCourierLookup(courierInfoOrder);
                const courierStatusQuery = courierLookup
                  ? courierStatusByKey.get(courierLookup.key)
                  : null;
                const liveStatus = normalizeCourierStatus(courierStatusQuery?.data);

                return (
                  <div className="mb-3">
                    <Badge variant="outline" className={courierStatusClass(liveStatus)}>
                      {courierStatusQuery?.isLoading
                        ? "Loading status"
                        : courierStatusQuery?.isError
                          ? "Status Error"
                          : courierStatusLabel(liveStatus)}
                    </Badge>
                  </div>
                );
              })()}
              <div className="bg-muted rounded-xl p-4 relative space-y-2">
                <p className="flex gap-2">
                  <span className="font-semibold">Courier Name:</span>{" "}
                  {courierInfoOrder.courierDetails?.courierName || "No entry yet"}
                </p>
                <p className="flex gap-2 text-sky-500">
                  <span className="font-semibold text-foreground">Consignment Id:</span>{" "}
                  #{courierInfoOrder.courierDetails?.consignment_id || "No entry yet"}
                </p>
                <p className="flex gap-2">
                  <span className="font-semibold">Invoice:</span> #{courierInfoOrder.courierDetails?.invoice || "No entry yet"}
                </p>
                <p className="flex gap-2">
                  <span className="font-semibold">Tracking Code:</span> #{courierInfoOrder.courierDetails?.tracking_code || "No entry yet"}
                </p>
              </div>
              <p className="mt-5 text-sm">
                Live tracking:{" "}
                {courierInfoOrder.courierDetails?.tracking_code ? (
                  <a
                    className="underline text-blue-500 font-semibold"
                    href={`https://steadfast.com.bd/t/${courierInfoOrder.courierDetails.tracking_code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    https://steadfast.com.bd/t/{courierInfoOrder.courierDetails.tracking_code}
                  </a>
                ) : (
                  "No entry yet"
                )}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCourierInfoOrder(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fraud Check Modal */}
      <Dialog open={!!fraudOrder} onOpenChange={(o) => !o && setFraudOrder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fraud Check Result - {fraudOrder?.customer?.phone}</DialogTitle>
          </DialogHeader>
          <div className="w-full min-h-[150px]">
            {fraudCheckLoading && (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            {fraudCheckError && (
              <div className="bg-destructive/10 text-destructive p-4 rounded-xl text-center">
                <p className="font-semibold">Error checking fraud status</p>
                <p className="text-sm">
                  {(fraudCheckErrorData as Error)?.message || "Something went wrong"}
                </p>
              </div>
            )}
            {fraudCheckData?.status === "success" && (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                {Object.entries(fraudCheckData?.data || {}).map(([key, courier]) => {
                  const successRatio = Number(courier.success_ratio) || 0;
                  const isRisky = successRatio < 50;
                  const totalParcels = Number(courier.total_parcel) || 0;
                  const successParcels = Number(courier.success_parcel) || 0;
                  const cancelledParcels = Number(courier.cancelled_parcel) || 0;

                  return (
                    <div
                      key={key}
                      className={`border rounded-xl p-3 flex items-center gap-3 ${isRisky ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900" : "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900"
                        }`}
                    >
                      {courier.logo && (
                        <img
                          src={courier.logo}
                          alt={courier.name}
                          className="w-12 h-12 object-contain rounded"
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-semibold">{courier.name}</p>
                        <div className="flex flex-wrap gap-2 text-xs mt-1">
                          <span>Total: <strong>{totalParcels}</strong></span>
                          <span className="text-green-600 dark:text-green-400">Success: <strong>{successParcels}</strong></span>
                          <span className="text-red-600 dark:text-red-400">Cancelled: <strong>{cancelledParcels}</strong></span>
                        </div>
                      </div>
                      <div
                        className={`text-center px-2 py-1 rounded-lg ${isRisky ? "bg-red-500 text-white" : "bg-green-500 text-white"
                          }`}
                      >
                        <p className="text-[10px] uppercase tracking-wider">Success</p>
                        <p className="font-bold">{successRatio.toFixed(1)}%</p>
                      </div>
                    </div>
                  );
                })}
                {Object.keys(fraudCheckData?.data || {}).length === 0 && (
                  <div className="bg-muted border border-border rounded-xl p-4 text-center">
                    <p className="text-muted-foreground font-semibold">No courier history found</p>
                    <p className="text-muted-foreground text-sm">This phone number has no records.</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setFraudOrder(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
