import type { Product } from "@/types/store";
import { resolveAssetUrl } from "@/lib/api";

export function getPrimaryImage(product: Pick<Product, "images">) {
  return resolveAssetUrl(product.images?.[0]) || "/placeholder.svg";
}
