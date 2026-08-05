import { useCallback, useEffect, useState, ReactNode } from "react";
import { Plus, Pencil, Trash2, Search, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { toast } from "@/hooks/use-toast";
import { resolveAssetUrl } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";

export type FieldType = "text" | "number" | "email" | "file" | "textarea" | "checkbox" | "select";

export interface CrudField<T> {
    key: keyof T;
    label: string;
    type?: FieldType;
    placeholder?: string;
    options?: { label: string; value: string | number }[] | ((values: Record<string, unknown>) => { label: string; value: string | number }[]);
    multiple?: boolean;
    showWhen?: (values: Record<string, unknown>) => boolean;
}

export interface CrudColumn<T> {
    key: keyof T | string;
    label: string;
    align?: "left" | "right";
    render?: (row: T) => ReactNode;
}

export type CrudMobileCardRenderer<T> = (
    row: T,
    actions: {
        onView?: () => void;
        onEdit: () => void;
        onDelete: () => void;
    },
) => ReactNode;

type ProductVariantDetails = {
    size: string;
    color: string;
    sku: string;
    openingStock: string;
    buyingPrice: string;
    oldPrice: string;
    customerPrice: string;
    extraPrice: string;
    imageMode: string;
    image: string;
    active: boolean;
};

interface Props<T extends { id: string | number }> {
    initialRows: T[];
    rows?: T[];
    onCreate?: (data: Partial<T>) => Promise<void> | void;
    onUpdate?: (row: T, data: Partial<T>) => Promise<void> | void;
    onDelete?: (row: T) => Promise<void> | void;
    isLoading?: boolean;
    disableLocalFilter?: boolean;
    onSearchChange?: (value: string) => void;
    columns: CrudColumn<T>[];
    fields: CrudField<T>[];
    searchKeys: (keyof T)[];
    entityName: string;
    newRow: () => Partial<T>;
    renderDetails?: (row: T) => ReactNode;
    renderMobileCard?: CrudMobileCardRenderer<T>;
    toolbarActions?: ReactNode;
}

export function CrudTable<T extends { id: string | number }>({
    initialRows,
    rows: controlledRows,
    onCreate,
    onUpdate,
    onDelete,
    isLoading = false,
    disableLocalFilter = false,
    onSearchChange,
    columns,
    fields,
    searchKeys,
    entityName,
    newRow,
    renderDetails,
    renderMobileCard,
    toolbarActions,
}: Props<T>) {
    const [rows, setRows] = useState<T[]>(initialRows);
    const [search, setSearch] = useState("");
    const [editing, setEditing] = useState<T | null>(null);
    const [creating, setCreating] = useState(false);
    const [deleting, setDeleting] = useState<T | null>(null);
    const [viewing, setViewing] = useState<T | null>(null);

    const dataRows = controlledRows ?? rows;

    const filtered = disableLocalFilter
        ? dataRows
        : dataRows.filter((r) =>
              searchKeys.some((k) =>
                  String(r[k] ?? "")
                      .toLowerCase()
                      .includes(search.toLowerCase()),
              ),
          );

    async function handleSubmit(data: Partial<T>, existing?: T) {
        try {
            if (existing) {
                if (onUpdate) {
                    await onUpdate(existing, data);
                } else {
                    setRows(rows.map((r) => (r.id === existing.id ? { ...existing, ...data } : r)));
                }
                toast({ title: `${entityName} updated` });
            } else {
                if (onCreate) {
                    await onCreate(data);
                } else {
                    const next = {
                        ...newRow(),
                        ...data,
                        id: `${entityName.toLowerCase()}_${Date.now()}`,
                    } as T;
                    setRows([next, ...rows]);
                }
                toast({ title: `${entityName} created` });
            }
            setEditing(null);
            setCreating(false);
        } catch (error: unknown) {
            console.error(`Error saving ${entityName}:`, error);
            const message = getErrorMessage(error);
            toast({
                title: `Failed to save ${entityName}`,
                description: message,
                variant: "destructive",
            });
        }
    }

    async function handleDelete(row: T) {
        try {
            if (onDelete) {
                await onDelete(row);
            } else {
                setRows(rows.filter((r) => r.id !== row.id));
            }
            toast({ title: `${entityName} deleted` });
            setDeleting(null);
        } catch (error: unknown) {
            console.error(`Error deleting ${entityName}:`, error);
            const message = getErrorMessage(error);
            toast({
                title: `Failed to delete ${entityName}`,
                description: message || "Please try again",
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
                        placeholder={`Search ${entityName.toLowerCase()}…`}
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            onSearchChange?.(e.target.value);
                        }}
                        className="h-10 rounded-xl pl-9"
                        />
                    </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button
                        onClick={() => setCreating(true)}
                        className="h-10 rounded-xl bg-gradient-primary text-primary-foreground shadow-soft hover:opacity-90"
                    >
                        <Plus className="mr-2 h-4 w-4" /> {entityName === "Product" ? "Add Product" : `New ${entityName.toLowerCase()}`}
                    </Button>
                    {toolbarActions}
                </div>
            </Card>

            {renderMobileCard && (
                <div className="space-y-3 sm:hidden">
                    {isLoading &&
                        filtered.length === 0 &&
                        Array.from({ length: 3 }).map((_, i) => (
                            <Card key={i} className="p-4 space-y-3">
                                <Skeleton className="h-4 w-1/2" />
                                <Skeleton className="h-4 w-2/3" />
                                <Skeleton className="h-10 w-full" />
                            </Card>
                        ))}
                    {filtered.map((row) =>
                        renderMobileCard(row, {
                            onView: renderDetails ? () => setViewing(row) : undefined,
                            onEdit: () => setEditing(row),
                            onDelete: () => setDeleting(row),
                        }),
                    )}
                    {!isLoading && filtered.length === 0 && (
                        <Card className="p-6 text-center text-muted-foreground">
                            No {entityName.toLowerCase()} found.
                        </Card>
                    )}
                </div>
            )}

            <Card className={`overflow-hidden shadow-soft ${renderMobileCard ? "hidden sm:block" : ""}`}>
                <div className="overflow-x-auto">
                    <Table className="min-w-[720px]">
                        <TableHeader>
                            <TableRow className="bg-secondary/40">
                                <TableHead className="w-12 text-center">#</TableHead>
                                {columns.map((c) => (
                                    <TableHead key={String(c.key)} className={c.align === "right" ? "text-right" : ""}>
                                        {c.label}
                                    </TableHead>
                                ))}
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading &&
                                filtered.length === 0 &&
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="text-center text-muted-foreground">
                                            <Skeleton className="h-4 w-6 mx-auto" />
                                        </TableCell>
                                        {columns.map((c) => (
                                            <TableCell key={String(c.key)}>
                                                <Skeleton className="h-4 w-3/4" />
                                            </TableCell>
                                        ))}
                                        <TableCell className="text-right">
                                            <Skeleton className="h-8 w-24 ml-auto" />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            {filtered.map((row, idx) => (
                                <TableRow key={row.id} className="hover:bg-secondary/30">
                                    <TableCell className="text-center text-muted-foreground text-sm">
                                        {idx + 1}
                                    </TableCell>
                                    {columns.map((c) => (
                                        <TableCell
                                            key={String(c.key)}
                                            className={c.align === "right" ? "text-right" : ""}
                                        >
                                            {c.render ? c.render(row) : String(row[c.key as keyof T] ?? "")}
                                        </TableCell>
                                    ))}
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            {renderDetails && (
                                                <Button size="icon" variant="ghost" onClick={() => setViewing(row)}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button size="icon" variant="ghost" onClick={() => setEditing(row)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => setDeleting(row)}
                                                className="text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {!isLoading && filtered.length === 0 && (
                                <TableRow>
                                    <TableCell
                                        colSpan={columns.length + 2}
                                        className="py-12 text-center text-muted-foreground"
                                    >
                                        No {entityName.toLowerCase()} found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            <FormDialog
                open={creating || !!editing}
                onOpenChange={(o) => {
                    if (!o) {
                        setCreating(false);
                        setEditing(null);
                    }
                }}
                title={editing ? `Edit ${entityName.toLowerCase()}` : `New ${entityName.toLowerCase()}`}
                entityName={entityName}
                fields={fields}
                existing={editing ?? undefined}
                defaults={creating ? newRow() : undefined}
                onSubmit={(d) => handleSubmit(d, editing ?? undefined)}
            />

            {renderDetails && (
                <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
                    <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[85vh] overflow-y-auto sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle className="font-display text-2xl">{entityName} details</DialogTitle>
                        </DialogHeader>
                        {viewing && renderDetails(viewing)}
                    </DialogContent>
                </Dialog>
            )}

            <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this {entityName.toLowerCase()}?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
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

function FormDialog<T>({
    open,
    onOpenChange,
    title,
    entityName,
    fields,
    existing,
    defaults,
    onSubmit,
}: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    title: string;
    entityName: string;
    fields: CrudField<T>[];
    existing?: T;
    defaults?: Partial<T>;
    onSubmit: (data: Partial<T>) => Promise<void> | void;
}) {
    const isProductForm = entityName === "Product";
    const standardSizes = ["M", "L", "XL", "XXL", "2Y", "4Y", "4/6", "6/8", "FREE SIZE"];
    const normalizeSizes = useCallback((value: unknown) => {
        if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
        return String(value || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
    }, []);
    const getVariantKey = useCallback((size: string, color: string) => `${size}__${color || "Default color"}`, []);
    const normalizeVariantDetails = useCallback(
        (value: unknown) => {
            const list = Array.isArray(value) ? value : [];
            return list.reduce<Record<string, ProductVariantDetails>>((acc, item) => {
                if (!item || typeof item !== "object") return acc;
                const variant = item as Record<string, unknown>;
                const size = String(variant.size || "").trim();
                const color = String(variant.color || "").trim();
                if (!size) return acc;

                acc[getVariantKey(size, color)] = {
                    size,
                    color,
                    sku: String(variant.sku || ""),
                    openingStock: String(variant.openingStock || ""),
                    buyingPrice: String(variant.buyingPrice || ""),
                    oldPrice: String(variant.oldPrice || ""),
                    customerPrice: String(variant.customerPrice || ""),
                    extraPrice: String(variant.extraPrice || ""),
                    imageMode: String(variant.imageMode || "default"),
                    image: String(variant.image || ""),
                    active: typeof variant.active === "boolean" ? variant.active : true,
                };
                return acc;
            }, {});
        },
        [getVariantKey],
    );
    const [isSaving, setIsSaving] = useState(false);
    const stockFieldKey = fields.find((field) => String(field.key) === "stock")?.key;
    const stockQtyFieldKey = fields.find((field) => String(field.key) === "stockQty")?.key;
    const getInitialFormValues = useCallback(() => {
        const values: Record<string, unknown> = {};

        fields.forEach((field) => {
            const key = String(field.key);
            values[key] = existing
                ? ((existing as Record<string, unknown>)[key] ?? "")
                : ((defaults as Record<string, unknown> | undefined)?.[key] ?? "");
        });

        return values;
    }, [defaults, existing, fields]);
    const [formValues, setFormValues] = useState<Record<string, unknown>>(getInitialFormValues);
    const [stockValue, setStockValue] = useState(() =>
        existing
            ? String((existing as Record<string, unknown>).stock ?? "")
            : String((defaults as Record<string, unknown> | undefined)?.stock ?? ""),
    );
    const [selectedSizes, setSelectedSizes] = useState<string[]>(() =>
        normalizeSizes(
            existing
                ? (existing as Record<string, unknown>).sizes
                : (defaults as Record<string, unknown> | undefined)?.sizes,
        ),
    );
    const [customSize, setCustomSize] = useState("");
    const [selectedColors, setSelectedColors] = useState<string[]>(() =>
        normalizeSizes((existing as Record<string, unknown> | undefined)?.colors),
    );
    const [customColor, setCustomColor] = useState("");
    const [variantDetails, setVariantDetails] = useState<Record<string, ProductVariantDetails>>(() =>
        normalizeVariantDetails((existing as Record<string, unknown> | undefined)?.variants),
    );

    useEffect(() => {
        setStockValue(
            existing
                ? String((existing as Record<string, unknown>).stock ?? "")
                : String((defaults as Record<string, unknown> | undefined)?.stock ?? ""),
        );
        setFormValues(getInitialFormValues());
        setSelectedSizes(
            normalizeSizes(
                existing
                    ? (existing as Record<string, unknown>).sizes
                    : (defaults as Record<string, unknown> | undefined)?.sizes,
            ),
        );
        setCustomSize("");
        setSelectedColors(normalizeSizes((existing as Record<string, unknown> | undefined)?.colors));
        setCustomColor("");
        setVariantDetails(normalizeVariantDetails((existing as Record<string, unknown> | undefined)?.variants));
    }, [defaults, existing, getInitialFormValues, normalizeSizes, normalizeVariantDetails, open]);

    const setFieldValue = (key: string, value: unknown) => {
        setFormValues((current) => ({
            ...current,
            [key]: value,
            ...(isProductForm && key === "categoryId" ? { subCategoryId: "" } : {}),
        }));
    };

    const setSizes = (nextSizes: string[]) => {
        const uniqueSizes = Array.from(new Set(nextSizes.map((size) => size.trim()).filter(Boolean)));
        setSelectedSizes(uniqueSizes);
        setFieldValue("sizes", uniqueSizes.join(", "));
    };

    const setColors = (nextColors: string[]) => {
        const uniqueColors = Array.from(new Set(nextColors.map((color) => color.trim()).filter(Boolean)));
        setSelectedColors(uniqueColors);
    };

    const setVariantDetail = (id: string, patch: Partial<ProductVariantDetails>) => {
        setVariantDetails((current) => ({
            ...current,
            [id]: {
                size: patch.size || current[id]?.size || "",
                color: patch.color ?? current[id]?.color ?? "",
                sku: patch.sku ?? current[id]?.sku ?? "",
                openingStock: patch.openingStock ?? current[id]?.openingStock ?? "",
                buyingPrice: patch.buyingPrice ?? current[id]?.buyingPrice ?? "",
                oldPrice: patch.oldPrice ?? current[id]?.oldPrice ?? "",
                customerPrice: patch.customerPrice ?? current[id]?.customerPrice ?? "",
                extraPrice: patch.extraPrice ?? current[id]?.extraPrice ?? "",
                imageMode: patch.imageMode ?? current[id]?.imageMode ?? "default",
                image: patch.image ?? current[id]?.image ?? "",
                active: patch.active ?? current[id]?.active ?? true,
            },
        }));
    };

    const currentVariantMode = String(
        formValues.variantMode ||
            (String(formValues.stitchType) === "unstitch"
                ? "simple"
                : selectedColors.length > 0
                  ? "sizeColor"
                  : "size"),
    );
    const variantColors = currentVariantMode === "sizeColor" && selectedColors.length > 0 ? selectedColors : ["Default color"];
    const variantCards = selectedSizes.flatMap((size) =>
        variantColors.map((color) => ({
            id: getVariantKey(size, color),
            size,
            color,
        })),
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={`w-[calc(100vw-1.5rem)] max-h-[90vh] overflow-y-auto ${isProductForm ? "sm:max-w-6xl" : "sm:max-w-lg"}`}>
                <DialogHeader>
                    <DialogTitle className="font-display text-2xl">
                        {isProductForm && !existing ? "Add Product" : title}
                    </DialogTitle>
                    {isProductForm && (
                        <p className="text-sm text-muted-foreground">
                            Create a complete product record with images, category, pricing, stock, and storefront flags.
                        </p>
                    )}
                </DialogHeader>
                <form
                    onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const data: Record<string, unknown> = {};
                        fields.forEach((f) => {
                            if (f.showWhen && !f.showWhen(formValues)) return;

                            const key = String(f.key);
                            const element = form.elements.namedItem(key);
                            if (!element) return;

                            if (f.type === "checkbox") {
                                data[key] = (element as HTMLInputElement).checked;
                                return;
                            }

                            if (f.type === "file") {
                                data[key] = (element as HTMLInputElement).files;

                                if (existing) {
                                    const existingValue = (existing as Record<string, unknown>)[key];

                                    if (typeof existingValue === "string") {
                                        const removeSingle = form.elements.namedItem(
                                            `${key}__removeExisting`,
                                        ) as HTMLInputElement | null;

                                        if (removeSingle?.checked) {
                                            data[`${key}Remove`] = true;
                                        }
                                    }

                                    if (Array.isArray(existingValue)) {
                                        const removeList = Array.from(
                                            form.querySelectorAll<HTMLInputElement>(
                                                `input[name="${key}__remove"]:checked`,
                                            ),
                                        ).map((el) => el.value);

                                        if (removeList.length > 0) {
                                            data[`${key}RemoveList`] = removeList;
                                        }
                                    }
                                }
                                return;
                            }

                            const value = (element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
                            data[key] = f.type === "number" ? Number(value) : value;
                        });

                        if (isProductForm) {
                            const variantFileInputs = Array.from(
                                form.querySelectorAll<HTMLInputElement>("input[data-product-variant-image]"),
                            );
                            const variantUploadIndexById = new Map<string, number>();
                            const variantFiles: File[] = [];

                            variantFileInputs.forEach((input) => {
                                const variantId = input.dataset.productVariantImage || "";
                                const file = input.files?.[0];
                                if (!variantId || !file) return;
                                variantUploadIndexById.set(variantId, variantFiles.length);
                                variantFiles.push(file);
                            });

                            data.colors = currentVariantMode === "sizeColor" ? selectedColors : [];
                            data.variants =
                                currentVariantMode === "simple"
                                    ? []
                                    : variantCards.map(({ id, size, color }) => {
                                          const detail = variantDetails[id];
                                          const uploadIndex = variantUploadIndexById.get(id);

                                          return {
                                              size,
                                              color: color === "Default color" ? "" : color,
                                              sku: detail?.sku || "",
                                              openingStock: detail?.openingStock || "",
                                              buyingPrice: detail?.buyingPrice || "",
                                              oldPrice: detail?.oldPrice || "",
                                              customerPrice: detail?.customerPrice || "",
                                              extraPrice: detail?.extraPrice || "",
                                              imageMode: detail?.imageMode || "default",
                                              image: detail?.image || "",
                                              imageUploadIndex: uploadIndex,
                                              active: detail?.active ?? true,
                                          };
                                      });

                            if (variantFiles.length > 0) {
                                data.variantImages = variantFiles;
                            }
                        }

                        setIsSaving(true);
                        try {
                            await onSubmit(data as Partial<T>);
                        } finally {
                            setIsSaving(false);
                        }
                    }}
                    className="space-y-4"
                >
                    <div className={`grid gap-4 ${isProductForm ? "lg:grid-cols-3" : "sm:grid-cols-2"}`}>
                        {fields.map((f) => {
                            if (f.showWhen && !f.showWhen(formValues)) return null;
                            const fieldOptions =
                                typeof f.options === "function" ? f.options(formValues) : (f.options ?? []);

                            return (
                            <div
                                key={String(f.key)}
                                className={`space-y-1.5 ${
                                    isProductForm && ["description", "productSummary", "images", "sizes"].includes(String(f.key))
                                        ? "lg:col-span-3"
                                        : ""
                                }`}
                            >
                                <Label htmlFor={String(f.key)}>{f.label}</Label>
                                {isProductForm && String(f.key) === "stitchType" ? (
                                    <div className="space-y-2">
                                        <input
                                            type="hidden"
                                            id={String(f.key)}
                                            name={String(f.key)}
                                            value={String(formValues[String(f.key)] || "stitch")}
                                        />
                                        <div className="grid overflow-hidden rounded-xl border bg-muted/40 p-1 sm:grid-cols-3">
                                            {[
                                                { label: "Simple", mode: "simple", value: "unstitch" },
                                                { label: "Size", mode: "size", value: "stitch" },
                                                { label: "Size x Color", mode: "sizeColor", value: "stitch" },
                                            ].map((option) => {
                                                const active = currentVariantMode === option.mode;
                                                return (
                                                    <button
                                                        key={option.label}
                                                        type="button"
                                                        onClick={() => {
                                                            setFieldValue("variantMode", option.mode);
                                                            setFieldValue(String(f.key), option.value);
                                                        }}
                                                        className={`h-10 rounded-lg text-sm font-semibold transition-colors ${
                                                            active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-background"
                                                        }`}
                                                    >
                                                        {option.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Select how shoppers choose product variants.
                                        </p>
                                    </div>
                                ) : isProductForm && String(f.key) === "sizes" ? (
                                    <div className="space-y-4 rounded-xl border bg-card p-4">
                                        <input
                                            type="hidden"
                                            id={String(f.key)}
                                            name={String(f.key)}
                                            value={selectedSizes.join(", ")}
                                        />
                                        <div>
                                            <p className="mb-2 text-sm font-semibold text-foreground">
                                                Available Sizes (select one or more)
                                            </p>
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                {standardSizes.map((size) => {
                                                    const checked = selectedSizes.includes(size);
                                                    return (
                                                        <label
                                                            key={size}
                                                            className={`flex h-11 items-center justify-between rounded-lg border px-3 text-sm font-medium transition-colors ${
                                                                checked ? "border-primary bg-primary/10" : "bg-background"
                                                            }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={(event) => {
                                                                    setSizes(
                                                                        event.target.checked
                                                                            ? [...selectedSizes, size]
                                                                            : selectedSizes.filter((item) => item !== size),
                                                                    );
                                                                }}
                                                            />
                                                            <span>{size}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Input
                                                value={customSize}
                                                onChange={(event) => setCustomSize(event.target.value)}
                                                placeholder="Custom size (e.g. 10Y, 28, 30)"
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => {
                                                    if (!customSize.trim()) return;
                                                    setSizes([...selectedSizes, customSize.trim()]);
                                                    setCustomSize("");
                                                }}
                                            >
                                                Add
                                            </Button>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex flex-wrap gap-2">
                                                <Button type="button" variant="outline" className="rounded-full">
                                                    Add Variant
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="rounded-full"
                                                    onClick={() => setSizes(selectedSizes)}
                                                >
                                                    Generate Size Variants
                                                </Button>
                                                {currentVariantMode === "sizeColor" && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="rounded-full"
                                                        onClick={() => setColors(selectedColors)}
                                                    >
                                                        Generate Size x Color Variants
                                                    </Button>
                                                )}
                                            </div>
                                            {currentVariantMode === "sizeColor" && (
                                                <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
                                                    <p className="text-sm font-semibold text-foreground">
                                                        Colours (one size can have multiple colours)
                                                    </p>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            value={customColor}
                                                            onChange={(event) => setCustomColor(event.target.value)}
                                                            placeholder="Add colour (e.g. Black, White, Red)"
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={() => {
                                                                if (!customColor.trim()) return;
                                                                setColors([...selectedColors, customColor.trim()]);
                                                                setCustomColor("");
                                                            }}
                                                        >
                                                            Add Color
                                                        </Button>
                                                    </div>
                                                    {selectedColors.length > 0 && (
                                                        <div className="flex flex-wrap gap-2">
                                                            {selectedColors.map((color) => (
                                                                <button
                                                                    key={color}
                                                                    type="button"
                                                                    onClick={() => setColors(selectedColors.filter((item) => item !== color))}
                                                                    className="rounded-full border bg-background px-3 py-1 text-sm font-medium hover:border-red-300 hover:text-red-600"
                                                                    title="Click to remove colour"
                                                                >
                                                                    {color} x
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {selectedSizes.length === 0 ? (
                                                <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                                                    Select a size to create variants.
                                                </div>
                                            ) : (
                                            <div className="grid gap-3 lg:grid-cols-2">
                                                {variantCards.map(({ id, size, color }) => {
                                                    const detail = variantDetails[id] ?? {
                                                        size,
                                                        color: color === "Default color" ? "" : color,
                                                        sku: "",
                                                        openingStock: "",
                                                        buyingPrice: "",
                                                        oldPrice: "",
                                                        customerPrice: "",
                                                        extraPrice: "",
                                                        imageMode: "default",
                                                        image: "",
                                                        active: true,
                                                    };

                                                    return (
                                                    <div key={id} className="rounded-xl border bg-secondary/20 p-3">
                                                        <div className="mb-3 flex items-start justify-between gap-3">
                                                            <div>
                                                                <p className="font-semibold text-foreground">
                                                                    {size} / {color}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {detail.sku ? `SKU: ${detail.sku}` : "SKU not set"}
                                                                </p>
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                className="h-8 border-red-200 text-red-600 hover:bg-red-50"
                                                                onClick={() => {
                                                                    if (currentVariantMode === "sizeColor" && color !== "Default color") {
                                                                        setColors(selectedColors.filter((item) => item !== color));
                                                                        return;
                                                                    }
                                                                    setSizes(selectedSizes.filter((item) => item !== size));
                                                                }}
                                                            >
                                                                Delete
                                                            </Button>
                                                        </div>
                                                        <div className="grid gap-2 sm:grid-cols-2">
                                                            <Input
                                                                value={detail.sku}
                                                                placeholder={`${size} / ${color} SKU`}
                                                                onChange={(event) =>
                                                                    setVariantDetail(id, { size, color: detail.color, sku: event.target.value })
                                                                }
                                                            />
                                                            <Input
                                                                value={detail.openingStock}
                                                                placeholder="Opening stock handle"
                                                                onChange={(event) =>
                                                                    setVariantDetail(id, {
                                                                        size,
                                                                        color: detail.color,
                                                                        openingStock: event.target.value,
                                                                    })
                                                                }
                                                            />
                                                            <Input
                                                                value={detail.buyingPrice}
                                                                placeholder="Buying price"
                                                                onChange={(event) =>
                                                                    setVariantDetail(id, {
                                                                        size,
                                                                        color: detail.color,
                                                                        buyingPrice: event.target.value,
                                                                    })
                                                                }
                                                            />
                                                            <Input
                                                                value={detail.oldPrice}
                                                                placeholder="Old price / compare price"
                                                                onChange={(event) =>
                                                                    setVariantDetail(id, {
                                                                        size,
                                                                        color: detail.color,
                                                                        oldPrice: event.target.value,
                                                                    })
                                                                }
                                                            />
                                                            <Input
                                                                value={detail.customerPrice}
                                                                placeholder="Customer price"
                                                                onChange={(event) =>
                                                                    setVariantDetail(id, {
                                                                        size,
                                                                        color: detail.color,
                                                                        customerPrice: event.target.value,
                                                                    })
                                                                }
                                                            />
                                                            <Input
                                                                value={detail.extraPrice}
                                                                placeholder="Extra price"
                                                                onChange={(event) =>
                                                                    setVariantDetail(id, {
                                                                        size,
                                                                        color: detail.color,
                                                                        extraPrice: event.target.value,
                                                                    })
                                                                }
                                                            />
                                                            <select
                                                                value={detail.imageMode}
                                                                onChange={(event) =>
                                                                    setVariantDetail(id, {
                                                                        size,
                                                                        color: detail.color,
                                                                        imageMode: event.target.value,
                                                                    })
                                                                }
                                                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                                            >
                                                                <option value="default">Use default image</option>
                                                                <option value="upload">Upload variant image</option>
                                                            </select>
                                                            <Input
                                                                type="file"
                                                                accept="image/*"
                                                                data-product-variant-image={id}
                                                                className="sm:col-span-2"
                                                            />
                                                            {detail.image && (
                                                                <div className="sm:col-span-2 flex items-center gap-3 rounded-md border bg-background p-2 text-xs text-muted-foreground">
                                                                    <img
                                                                        src={resolveAssetUrl(detail.image)}
                                                                        alt=""
                                                                        className="h-12 w-12 rounded object-cover"
                                                                    />
                                                                    <span>Current variant image</span>
                                                                </div>
                                                            )}
                                                            <label className="flex h-10 items-center justify-between rounded-md border px-3 text-sm sm:col-span-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={detail.active}
                                                                    onChange={(event) =>
                                                                        setVariantDetail(id, {
                                                                            size,
                                                                            color: detail.color,
                                                                            active: event.target.checked,
                                                                        })
                                                                    }
                                                                />
                                                                <span>Active</span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                    );
                                                })}
                                            </div>
                                            )}
                                        </div>
                                    </div>
                                ) : f.type === "textarea" ? (
                                    <textarea
                                        id={String(f.key)}
                                        name={String(f.key)}
                                        defaultValue={
                                            existing
                                                ? String((existing as Record<string, unknown>)[String(f.key)] ?? "")
                                                : defaults
                                                  ? String((defaults as Record<string, unknown>)[String(f.key)] ?? "")
                                                : ""
                                        }
                                        placeholder={f.placeholder}
                                        onChange={(e) => setFieldValue(String(f.key), e.target.value)}
                                        className={`w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ${
                                            isProductForm ? "min-h-[96px]" : "min-h-[120px]"
                                        }`}
                                    />
                                ) : f.type === "select" ? (
                                    <select
                                        id={String(f.key)}
                                        name={String(f.key)}
                                        value={
                                            String(f.key) === String(stockFieldKey)
                                                ? stockValue
                                                : String(formValues[String(f.key)] ?? "")
                                        }
                                        onChange={
                                            String(f.key) === String(stockFieldKey)
                                                ? (e) => {
                                                      setStockValue(e.target.value);
                                                      setFieldValue(String(f.key), e.target.value);
                                                  }
                                                : (e) => setFieldValue(String(f.key), e.target.value)
                                        }
                                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                                    >
                                        <option value="">Select...</option>
                                        {fieldOptions.map((opt) => (
                                            <option key={String(opt.value)} value={String(opt.value)}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                ) : f.type === "checkbox" ? (
                                    <div className="flex items-center gap-2 h-10">
                                        <input
                                            id={String(f.key)}
                                            name={String(f.key)}
                                            type="checkbox"
                                            defaultChecked={
                                                existing
                                                    ? Boolean((existing as Record<string, unknown>)[String(f.key)])
                                                    : defaults
                                                      ? Boolean((defaults as Record<string, unknown>)[String(f.key)])
                                                    : false
                                            }
                                            onChange={(e) => setFieldValue(String(f.key), e.target.checked)}
                                        />
                                        <span className="text-sm text-muted-foreground">Enable</span>
                                    </div>
                                ) : f.type === "file" ? (
                                    <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                                        {existing &&
                                            (() => {
                                                const existingValue = (existing as Record<string, unknown>)[
                                                    String(f.key)
                                                ];

                                                if (typeof existingValue === "string" && existingValue.length > 0) {
                                                    const storedPath =
                                                        existingValue.match(/\/public\/.+$/)?.[0] ?? existingValue;

                                                    return (
                                                        <div className="space-y-2">
                                                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                                Current image
                                                            </div>
                                                            <label className="group relative block h-32 w-32 overflow-hidden rounded-lg border bg-background shadow-sm">
                                                                <img
                                                                    src={resolveAssetUrl(existingValue)}
                                                                    alt="Current"
                                                                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                                                />
                                                                <span className="absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-md bg-background/95 px-2 py-1 text-xs font-medium shadow-sm">
                                                                    <input
                                                                        type="checkbox"
                                                                        name={`${String(f.key)}__removeExisting`}
                                                                        value={storedPath}
                                                                    />
                                                                    Remove
                                                                </span>
                                                            </label>
                                                        </div>
                                                    );
                                                }

                                                if (Array.isArray(existingValue) && existingValue.length > 0) {
                                                    const stringImages = existingValue.filter(
                                                        (v): v is string => typeof v === "string" && v.length > 0,
                                                    );

                                                    if (stringImages.length === 0) {
                                                        return null;
                                                    }

                                                    return (
                                                        <div className="space-y-3">
                                                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                                Existing images
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                                                                {stringImages.map((img) => {
                                                                    const storedPath = img.match(/\/public\/.+$/)?.[0] ?? img;

                                                                    return (
                                                                    <label
                                                                        key={img}
                                                                        className="group relative block aspect-square overflow-hidden rounded-lg border bg-background shadow-sm"
                                                                    >
                                                                        <img
                                                                            src={resolveAssetUrl(img)}
                                                                            alt="Current"
                                                                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                                                        />
                                                                        <span className="absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-md bg-background/95 px-2 py-1 text-xs font-medium shadow-sm">
                                                                            <input
                                                                              type="checkbox"
                                                                              name={`${String(f.key)}__remove`}
                                                                              value={storedPath}
                                                                            />
                                                                            Remove
                                                                        </span>
                                                                    </label>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                return null;
                                            })()}

                                        <div className="rounded-lg border border-dashed border-primary/30 bg-background p-4">
                                            <Input
                                                id={String(f.key)}
                                                name={String(f.key)}
                                                type="file"
                                                accept="image/*"
                                                multiple={Boolean(f.multiple)}
                                                onChange={(e) => setFieldValue(String(f.key), e.target.files)}
                                                className="cursor-pointer border-0 bg-transparent p-0 shadow-none file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
                                            />
                                            <p className="mt-2 text-xs text-muted-foreground">
                                                Upload product image{f.multiple ? "s" : ""}. Existing checked images will be removed when you save.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <Input
                                        id={String(f.key)}
                                        name={String(f.key)}
                                        type={f.type ?? "text"}
                                        multiple={f.type === ("file" as string) && Boolean(f.multiple)}
                                        defaultValue={
                                            existing
                                                ? String((existing as Record<string, unknown>)[String(f.key)] ?? "")
                                                : defaults
                                                  ? String((defaults as Record<string, unknown>)[String(f.key)] ?? "")
                                                : ""
                                        }
                                        onChange={
                                            String(f.key) === String(stockQtyFieldKey)
                                                ? (e) => {
                                                      setFieldValue(String(f.key), e.target.value);
                                                      const quantity = Number(e.target.value);
                                                      if (Number.isFinite(quantity) && quantity > 0) {
                                                          setStockValue("available");
                                                      }
                                                  }
                                                : (e) => setFieldValue(String(f.key), e.target.value)
                                        }
                                        placeholder={f.placeholder}
                                    />
                                )}
                            </div>
                            );
                        })}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-gradient-primary text-primary-foreground"
                            disabled={isSaving}
                        >
                            {isSaving ? "Saving..." : existing ? `Update ${entityName}` : `Create ${entityName}`}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
