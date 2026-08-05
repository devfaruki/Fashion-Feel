import type { Product } from "@/types/store";
import { resolveAssetUrl } from "@/lib/api";

const PRODUCT_PLACEHOLDER = "/placeholder.svg";

export function getProductImages(product: Product) {
  return (product.images ?? [])
    .map((img) => resolveAssetUrl(img))
    .filter((img): img is string => Boolean(img));
}

export function getPrimaryImage(product: Product) {
  return resolveAssetUrl(product.images?.[0]) || PRODUCT_PLACEHOLDER;
}

export function getHoverImage(product: Product) {
  return resolveAssetUrl(product.images?.[1] || product.images?.[0]) || PRODUCT_PLACEHOLDER;
}
