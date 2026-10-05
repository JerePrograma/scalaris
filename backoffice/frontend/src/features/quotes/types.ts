import type { Data } from "../../shared/types";

export interface Item {
  kind: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountType: string;
  discountValue: string;
  gross?: string;
  discount?: string;
  total?: string;
}
export interface Quote {
  items: Item[];
  discountType: string;
  discountValue: string;
  manualTotal?: string;
  adjustmentReason: string;
  conditions: string;
  leadTime: string;
  issueDate: string;
  expiryDate: string;
  depositPercent: string;
  client?: Data;
  revision?: number;
  quoteNumber?: number;
  caseTitle?: string;
  suggestedDeposit?: string;
}
export interface Revision {
  id: number;
  version: number;
  revision: number;
  status: string;
  snapshot: Quote;
  subtotal: string;
  discount: string;
  adjustment: string;
  total: string;
  accepted_at?: string;
  acceptance?: { channel: string; note: string };
}
export interface Calculation {
  subtotal: string;
  discount: string;
  adjustment: string;
  total: string;
}
