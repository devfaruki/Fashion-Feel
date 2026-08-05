import { resolveAssetUrl } from "@/lib/api";
import { getPrimaryImage, getProductImages } from "@/lib/product-images";
import type { Product } from "@/types/store";

export type ProductVariant = NonNullable<Product["variants"]>[number];

export function getActiveVariants(product?: Product | null) {
  return (product?.variants ?? []).filter(
    (variant) => variant?.active !== false && Boolean(variant?.size),
  );
}

export function getVariantPrice(variant?: ProductVariant | null) {
  const value = Number(variant?.customerPrice || 0);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function getVariantOldPrice(variant?: ProductVariant | null) {
  const value = Number(variant?.oldPrice || 0);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function getDiscountPair(price?: number | null, comparePrice?: number | null) {
  if (!price || price <= 0) return { salePrice: 0, oldPrice: null, discountPercent: 0 };
  if (!comparePrice || comparePrice <= 0 || comparePrice === price) {
    return { salePrice: price, oldPrice: null, discountPercent: 0 };
  }

  const salePrice = Math.min(price, comparePrice);
  const oldPrice = Math.max(price, comparePrice);
  return {
    salePrice,
    oldPrice,
    discountPercent: Math.round(((oldPrice - salePrice) / oldPrice) * 100),
  };
}

export function getVariantPriceRange(product?: Product | null) {
  const prices = getActiveVariants(product)
    .map((variant) => getDiscountPair(getVariantPrice(variant), getVariantOldPrice(variant)).salePrice)
    .filter((price) => price > 0);

  if (prices.length === 0) return product?.priceRange ?? null;

  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}

export function getVariantOldPriceRange(product?: Product | null) {
  const prices = getActiveVariants(product)
    .map((variant) => getDiscountPair(getVariantPrice(variant), getVariantOldPrice(variant)).oldPrice)
    .filter((price): price is number => typeof price === "number" && price > 0);

  if (prices.length === 0) return product?.oldPriceRange ?? null;

  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}

export function formatPriceRange(range?: { min: number; max: number } | null) {
  if (!range) return "";
  return range.min === range.max
    ? `BDT ${range.min.toLocaleString()}`
    : `BDT ${range.min.toLocaleString()} - ${range.max.toLocaleString()}`;
}

export function formatProductPrice(product: Product, selectedPrice?: number | null) {
  if (selectedPrice && selectedPrice > 0) return `BDT ${selectedPrice.toLocaleString()}`;

  const range = getVariantPriceRange(product) ?? product.priceRange;
  if (range) return formatPriceRange(range);

  return `BDT ${product.price.toLocaleString()}`;
}

export function formatProductOldPrice(product: Product, selectedOldPrice?: number | null) {
  if (selectedOldPrice && selectedOldPrice > 0) return `BDT ${selectedOldPrice.toLocaleString()}`;

  const range = product.oldPriceRange ?? getVariantOldPriceRange(product);
  if (range) return formatPriceRange(range);

  return product.oldPrice && product.oldPrice > 0 ? `BDT ${product.oldPrice.toLocaleString()}` : "";
}

export function getProductDiscountPercent(product: Product, variant?: ProductVariant | null) {
  const hasVariants = getActiveVariants(product).length > 0;
  const price = hasVariants ? getVariantPrice(variant) : product.price;
  const oldPrice = hasVariants ? getVariantOldPrice(variant) : product.oldPrice;

  return getDiscountPair(price, oldPrice).discountPercent;
}

export function getMaxVariantDiscountPercent(product: Product) {
  return getActiveVariants(product).reduce((max, variant) => {
    return Math.max(max, getProductDiscountPercent(product, variant));
  }, 0);
}

export function getVariantStock(variant?: ProductVariant | null) {
  if (!variant) return null;
  const value = Number(variant.openingStock || 0);
  return Number.isFinite(value) ? value : null;
}

export function getVariantImage(variant?: ProductVariant | null) {
  return resolveAssetUrl(variant?.image);
}

export function getProductGallery(product: Product) {
  const productImages = getProductImages(product);
  const variantImages = (product.variants ?? [])
    .map((variant) => getVariantImage(variant))
    .filter((image): image is string => Boolean(image));
  const gallery = Array.from(new Set([...productImages, ...variantImages]));
  return gallery.length > 0 ? gallery : [getPrimaryImage(product)];
}

export function getVariantLabel(variant?: ProductVariant | null, fallback = "Standard") {
  if (!variant) return fallback;
  return [variant.size, variant.color].filter(Boolean).join(" / ") || fallback;
}

export function getVariantAwareProduct(product: Product, variant?: ProductVariant | null) {
  const variantImage = getVariantImage(variant);
  const gallery = getProductGallery(product);
  const images = variantImage ? Array.from(new Set([variantImage, ...gallery])) : gallery;
  const hasVariants = getActiveVariants(product).length > 0;
  const rawPrice = getVariantPrice(variant) ?? product.price;
  const rawOldPrice = hasVariants ? getVariantOldPrice(variant) : product.oldPrice;
  const { salePrice, oldPrice } = getDiscountPair(rawPrice, rawOldPrice);
  const price = salePrice || rawPrice;

  return {
    displayPrice: price,
    displayOldPrice: oldPrice,
    displayImages: images,
    cartProduct: { ...product, price, oldPrice, images },
  };
}
