import { test, expect } from "vitest";
import { expiryDate, quoteRequest, newItem } from "./draft";

test("suggested expiry excludes issue date and weekends", () => {
  expect(expiryDate("2026-10-02")).toBe("2026-10-09");
  expect(expiryDate("2026-10-03")).toBe("2026-10-09");
});
test("revision copy strips calculated fields and historical client from request", () => {
  const input = {
    items: [
      {
        ...newItem(),
        description: "Trabajo",
        gross: "15000",
        total: "15000",
        discount: "0",
      },
    ],
    discountType: "NONE",
    discountValue: "0",
    manualTotal: "",
    adjustmentReason: "",
    conditions: "",
    leadTime: "2 días",
    issueDate: "2026-10-03",
    expiryDate: "2026-10-09",
    depositPercent: "10",
    client: { name: "Histórico" },
    quoteNumber: 22,
  };
  const result = quoteRequest(input);
  expect(result).not.toHaveProperty("client");
  expect(result).not.toHaveProperty("quoteNumber");
  expect(result.items[0]).not.toHaveProperty("total");
  expect(result.items[0].unitPrice).toBe("0");
});
