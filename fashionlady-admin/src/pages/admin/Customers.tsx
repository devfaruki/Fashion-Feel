import { useState, useEffect, useRef } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Trash2, Search, RefreshCw, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
import { toast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { api, resolveAssetUrl } from "@/lib/api";
import { cn, getErrorMessage } from "@/lib/utils";
import type { OrderItem, Order } from "@/types/store";

interface Customer {
  id: number;
  customerId: string;
  name: string;
  phone: string;
  address: string;
  district?: string;
  thana?: string;
  createdAt: string;
  orderCount?: number;
  totalSpent?: number;
}

export default function Customers() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const [viewing, setViewing] = useState<Customer | null>(null);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const customersQuery = useInfiniteQuery({
    queryKey: ["admin-customers", debouncedSearch],
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get("/customer/all-customer", {
        params: { page: pageParam, limit: 10, search: debouncedSearch },
      });
      return data.data as {
        customers: Customer[];
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

  const customers = customersQuery.data?.pages.flatMap((p) => p.customers) ?? [];

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          customersQuery.hasNextPage &&
          !customersQuery.isFetchingNextPage
        ) {
          customersQuery.fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [customersQuery]);

  useEffect(() => {
    if (historyCustomer) {
      const fetchHistory = async () => {
        setLoadingOrders(true);
        try {
          const res = await api.get(`/customer/customer-orders/${historyCustomer.id}`);
          setCustomerOrders(res.data?.data ?? []);
        } catch (err: unknown) {
          console.error("Failed to fetch orders:", err);
          toast({ title: "Error", description: "Failed to load order history.", variant: "destructive" });
        } finally {
          setLoadingOrders(false);
        }
      };
      fetchHistory();
    } else {
      setCustomerOrders([]);
    }
  }, [historyCustomer]);

  const formatDate = (d: string) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-BD", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  async function handleUpdate(customerId: number, data: Record<string, unknown>) {
    try {
      await api.patch(`/customer/update-customer/${customerId}`, data);
      toast({ title: "Customer updated" });
      await queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      setEditing(null);
    } catch (err: unknown) {
      const message = getErrorMessage(err) || "Failed to update customer.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  }

  async function handleDelete(c: Customer) {
    try {
      await api.delete(`/customer/delete-customer/${c.id}`);
      toast({ title: "Customer deleted", description: `${c.name} removed.` });
      await queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      setDeleting(null);
    } catch (err: unknown) {
      const message = getErrorMessage(err) || "Failed to delete customer.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-3 p-4 shadow-soft md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, district, thana…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            className="h-10 rounded-xl pl-9"
          />
        </div>
        <Button
          onClick={() => customersQuery.refetch()}
          variant="outline"
          className="h-10 rounded-xl"
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </Card>

      <Card className="overflow-hidden shadow-soft text-nowrap">
        <div className="overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow className="bg-secondary/40">
                <TableHead className="w-12 text-center">#</TableHead>
                 <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customersQuery.isLoading &&
                customers.length === 0 &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-6 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))}
              {customers.map((c, idx) => (
                <TableRow key={c.id} className="hover:bg-secondary/30">
                  <TableCell className="text-center text-muted-foreground text-sm">
                    {idx + 1}
                  </TableCell>
                  <TableCell>
                    <div className="leading-tight">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                        ID: {c.customerId?.slice(0, 8) || c.id}
                      </div>
                    </div>
                  </TableCell>
                   <TableCell>{c.phone}</TableCell>
                  <TableCell>
                    <div className="leading-tight text-sm">
                      <div>{c.district || "—"}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                        {c.thana || "—"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {c.orderCount ?? 0}
                  </TableCell>
                  <TableCell className="font-medium text-primary">
                    ৳{(c.totalSpent ?? 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(c.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                       <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setViewing(c)}
                        title="View Info"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setHistoryCustomer(c)}
                        title="Order History"
                        className="text-primary hover:text-primary"
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditing(c)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleting(c)}
                        title="Delete"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!customersQuery.isLoading && customers.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-12 text-center text-muted-foreground"
                  >
                    No customers found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

      </Card>

      <div ref={loadMoreRef} className="h-8" />

      {/* View modal */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">
                  Customer Details
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">
                    Name
                  </div>
                  <div>{viewing.name}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">
                    Phone
                  </div>
                  <div>{viewing.phone}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">
                    Address
                  </div>
                  <div>{viewing.address || "—"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">
                    District
                  </div>
                  <div>{viewing.district || "—"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">
                    Thana / Upazila
                  </div>
                  <div>{viewing.thana || "—"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">
                    Customer ID
                  </div>
                  <div className="text-sm font-mono">
                    {viewing.customerId || viewing.id}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">
                    Joined
                  </div>
                  <div>{formatDate(viewing.createdAt)}</div>
                </div>
              </div>
              <DialogFooter>
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

      {/* Edit modal */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">
                  Edit Customer
                </DialogTitle>
              </DialogHeader>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  setIsSaving(true);
                  try {
                    await handleUpdate(editing.id, {
                      name: String(fd.get("name")),
                      phone: String(fd.get("phone")),
                      address: String(fd.get("address")),
                      district: String(fd.get("district")),
                      thana: String(fd.get("thana")),
                    });
                  } finally {
                    setIsSaving(false);
                  }
                }}
                className="space-y-4"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      name="name"
                      defaultValue={editing.name}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      defaultValue={editing.phone}
                      required
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      name="address"
                      defaultValue={editing.address}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="district">District</Label>
                    <Input
                      id="district"
                      name="district"
                      defaultValue={editing.district || ""}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="thana">Thana / Upazila</Label>
                    <Input
                      id="thana"
                      name="thana"
                      defaultValue={editing.thana || ""}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditing(null)}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-gradient-primary text-primary-foreground"
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving..." : "Update Customer"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={!!historyCustomer} onOpenChange={(o) => !o && setHistoryCustomer(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl flex items-center justify-between">
              Order History
              <span className="text-sm font-normal text-muted-foreground">
                {historyCustomer?.name}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 mt-4">
            {loadingOrders ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            ) : customerOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No orders found for this customer.
              </div>
            ) : (
              <div className="space-y-4">
                {customerOrders.map((order) => (
                  <Card key={order.id} className="p-4 border-l-4 border-l-primary shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-lg">Order #{String(order.id).padStart(4, '0')}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(order.orderDate)}</div>
                      </div>
                      <div className={cn(
                        "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                        order.orderStatus === "DELIVERED" ? "bg-green-100 text-green-700" :
                        order.orderStatus === "CANCELLED" ? "bg-red-100 text-red-700" :
                        "bg-blue-100 text-blue-700"
                      )}>
                        {order.orderStatus}
                      </div>
                    </div>

                    {/* Product Details */}
                    <div className="my-3 space-y-3 border-y border-border/50 py-3">
                      {Array.isArray(order.items) && order.items.map((item: OrderItem, i: number) => (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <div className="h-10 w-10 flex-shrink-0 bg-secondary rounded overflow-hidden flex items-center justify-center">
                            {item.image ? (
                              <img 
                                src={resolveAssetUrl(item.image)} 
                                alt="" 
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                  (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="text-muted-foreground/40"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package"><path d="M16.5 9.4 7.5 4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/></svg></div>';
                                }}
                              />
                            ) : (
                              <Package className="h-4 w-4 text-muted-foreground/40" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between">
                              <span className="font-medium truncate pr-2">{item.name}</span>
                              <span className="text-muted-foreground whitespace-nowrap">৳{(Number(item.price ?? 0) * Number(item.quantity ?? item.qty ?? 1)).toLocaleString()}</span>
                            </div>
                            <div className="flex gap-2 text-[10px] text-muted-foreground">
                              <span className="font-mono">Qty: {item.quantity ?? item.qty ?? 1}</span>
                              {item.size && <span className="bg-secondary px-1 rounded">Size: {item.size}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Total:</span>
                        <span className="ml-2 font-medium">৳{order.totalPrice.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Payment:</span>
                        <span className="ml-2 font-medium">{order.paymentMethod}</span>
                      </div>
                    </div>
                    {order.note && (
                      <div className="mt-2 text-xs text-muted-foreground bg-secondary/50 p-2 rounded">
                        <strong>Note:</strong> {order.note}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setHistoryCustomer(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Customers with associated orders
              cannot be deleted.
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
    </div>
  );
}
