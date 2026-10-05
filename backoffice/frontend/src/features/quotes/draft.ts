import type { Item, Quote } from "./types";

export function expiryDate(date: string) {
  const d = new Date(date + "T12:00:00Z");
  let i = 0;
  while (i < 5) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) i++;
  }
  return d.toISOString().slice(0, 10);
}
export const newItem = (): Item => ({
  kind: "LABOR",
  description: "",
  quantity: "1",
  unit: "servicio",
  unitPrice: "0",
  discountType: "NONE",
  discountValue: "0",
});
export const quoteRequest = (q: Quote) => ({
  items: q.items.map(
    ({
      kind,
      description,
      quantity,
      unit,
      unitPrice,
      discountType,
      discountValue,
    }) => ({
      kind,
      description,
      quantity,
      unit,
      unitPrice,
      discountType,
      discountValue,
    }),
  ),
  discountType: q.discountType,
  discountValue: q.discountValue,
  ...(q.manualTotal ? { manualTotal: q.manualTotal } : {}),
  adjustmentReason: q.adjustmentReason,
  conditions: q.conditions,
  leadTime: q.leadTime,
  issueDate: q.issueDate,
  expiryDate: q.expiryDate,
  depositPercent: q.depositPercent,
});
