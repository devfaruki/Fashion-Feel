export type Category = {
  id: number;
  name: string;
  image?: string | null;
  status?: string | null;
  count?: number;
  subCategories?: SubCategory[];
};

export type SubCategory = {
  id: number;
  name: string;
  image?: string | null;
  status?: string | null;
  categoryId: number;
  count?: number;
};

export type Brand = {
  id: number;
  name: string;
  image?: string | null;
  status?: string | null;
  count?: number;
};

export type Product = {
  id: number;
  productId?: number;
  name: string;
  brandId?: number | null;
  brand?: Brand | null;
  categoryId?: number | null;
  category?: Category | null;
  subCategoryId?: number | null;
  subCategory?: SubCategory | null;
  price: number;
  priceRange?: { min: number; max: number } | null;
  oldPriceRange?: { min: number; max: number } | null;
  oldPrice?: number | null;
  badge?: string | null;
  images: string[];
  sizes?: string[] | null;
  colors?: string[] | null;
  variants?: Array<{
    size?: string;
    color?: string;
    sku?: string;
    openingStock?: string;
    buyingPrice?: string;
    oldPrice?: string;
    customerPrice?: string;
    extraPrice?: string;
    imageMode?: string;
    image?: string;
    imageUploadIndex?: number;
    active?: boolean;
  }> | null;
  productSummary?: string | null;
  description?: string | null;
  isNew?: boolean | null;
  isFeatured?: boolean | null;
  stockQty?: number;
  stock?: string | null;
};

export type HeroSection = {
  id: number;
  title: string;
  subtitle: string;
  buttonText: string;
  buttonUrl: string;
  image: string;
  mobileImage: string;
  order: number;
  status: string;
};
