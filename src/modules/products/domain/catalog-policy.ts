export interface CatalogPolicy {
  /** Products with this many available units or fewer are shown as LOW_STOCK (BR-14). */
  readonly lowStockThreshold: number;
  /** Maximum units a customer can buy in a single order. */
  readonly maxUnitsPerOrder: number;
}
