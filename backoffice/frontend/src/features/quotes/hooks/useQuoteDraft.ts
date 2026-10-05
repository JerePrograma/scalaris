import { useRef, useState } from "react";
import { newItem, expiryDate } from "../draft";
import { today } from "../../../shared/format";
import { saveRevision, calculateQuote } from "../api";
import type { Quote, Item, Revision, Calculation } from "../types";

export function useQuoteDraft({
  caseId,
  source,
  edit,
  onSaved,
}: {
  caseId: number;
  source?: Revision;
  edit?: boolean;
  onSaved: () => void;
}) {
  const [q, setQuote] = useState<Quote>(source?.snapshot || {
    items: [newItem()],
    discountType: "NONE",
    discountValue: "0",
    adjustmentReason: "",
    conditions:
      "Repuestos y licencias comerciales legítimas provistas/autorizadas se detallan aparte. La seña y el saldo pendiente generan advertencia; no bloquean trabajo ni entrega.",
    leadTime: "",
    issueDate: today(),
    expiryDate: expiryDate(today()),
    depositPercent: "10",
  });
  const [calc, setCalc] = useState<Calculation | null>(null);
  const [error, setError] = useState("");
  const calculationVersion = useRef(0);

  function update(changes: Partial<Quote>) {
    calculationVersion.current++;
    setQuote({ ...q, ...changes });
    setCalc(null);
  }
  function change<K extends keyof Quote>(key: K, value: Quote[K]) {
    update({ [key]: value });
  }
  function line(i: number, key: keyof Item, value: string) {
    change("items", q.items.map((it, j) => (j === i ? { ...it, [key]: value } : it)));
  }
  async function save() {
    await saveRevision(caseId, q, edit, source);
    onSaved();
  }
  async function calculate() {
    const version = ++calculationVersion.current;
    setError("");
    try {
      const result = await calculateQuote(q);
      if (version === calculationVersion.current) setCalc(result);
    } catch (e) {
      if (version === calculationVersion.current) setError((e as Error).message);
    }
  }

  return { q, calc, error, change, update, line, save, calculate };
}
