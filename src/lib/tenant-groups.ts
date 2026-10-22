export const TENANT_GROUPS = [
  { slug: "fish-dealer", category: "fish_dealer", label: "Fish Dealer" },
  { slug: "fish-broker", category: "fish_broker", label: "Fish Broker" },
  { slug: "cold-storage-ice-dealer-ice-retailer", category: "cold_storage_ice", label: "Cold Storage / Ice Dealer / Ice Retailer" },
  { slug: "retail-fish-seafood", category: "retail_fish_seafood", label: "Retail Sale of Fish and Other Seafood (Fresh and Dried)" },
  { slug: "fish-drying", category: "fish_drying", label: "Drying of Fish and Other Marine Products" },
  { slug: "fish-smoking", category: "fish_smoking", label: "Smoking of Fish (Tinapa) and Other Marine Products" },
  { slug: "commercial-vessel-above-3-tons", category: "commercial_vessel_above_3t", label: "Commercial Fishing Vessel Above 3 Tons" },
  { slug: "commercial-vessel-below-3-tons", category: "commercial_vessel_below_3t", label: "Commercial Fishing Vessel Below 3 Tons" },
  { slug: "marine-products", category: "marine_products", label: "Marine Products" },
  { slug: "marine-fishing-supply", category: "marine_fishing_supply", label: "Marine Fishing Supply" },
  { slug: "carinderia-eatery", category: "carinderia_eatery", label: "Carinderia / Eatery" },
] as const;

export type TenantGroup = (typeof TENANT_GROUPS)[number];
export type TenantCategory = TenantGroup["category"];

export function tenantGroupBySlug(slug: string) {
  return TENANT_GROUPS.find((group) => group.slug === slug);
}
