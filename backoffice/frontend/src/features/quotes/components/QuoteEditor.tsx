import { newItem, expiryDate } from "../draft";
import { money } from "../../../shared/format";
import { kinds } from "../../catalog/labels";
import type { Catalog } from "../../catalog/types";
import type { Revision } from "../types";
import { Form, Text, Field } from "../../../shared/components";
import { useQuoteDraft } from "../hooks/useQuoteDraft";

export function QuoteEditor({
  caseId,
  source,
  edit,
  catalog,
  onSaved,
}: {
  caseId: number;
  source?: Revision;
  edit?: boolean;
  catalog: Catalog[];
  onSaved: () => void;
}) {
  const { q, calc, error, change, update, line, save, calculate } =
    useQuoteDraft({ caseId, source, edit, onSaved });
  return (
    <Form
      label={edit ? "Guardar borrador" : "Crear revisión"}
      onSubmit={save}
    >
      <p className="muted">
        Los importes definitivos se calculan en el servidor. Decimal con punto,
        hasta 2 decimales en precios y 3 en cantidades. En software, usá horas
        estimadas; las reales no modifican el total aceptado.
      </p>
      <Field label="Agregar desde catálogo (copia la tarifa actual)">
        <select
          value=""
          onChange={(e) => {
            const c = catalog.find((c) => c.id === Number(e.target.value));
            if (c)
              change("items", [
                ...q.items,
                {
                  ...newItem(),
                  kind: c.kind,
                  description: c.description,
                  unit: c.unit,
                  unitPrice: c.price,
                },
              ]);
          }}
        >
          <option value="">Seleccionar servicio</option>
          {catalog
            .filter((c) => c.active)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.description} · {money(c.price)}
              </option>
            ))}
        </select>
      </Field>
      {q.items.map((it, i) => (
        <article className="line-item" key={i}>
          <div className="row between">
            <strong>Concepto {i + 1}</strong>
            <button
              type="button"
              disabled={q.items.length === 1}
              onClick={() =>
                change(
                  "items",
                  q.items.filter((_, j) => i !== j),
                )
              }
            >
              Quitar
            </button>
          </div>
          <div className="grid two">
            <Field label="Tipo">
              <select
                value={it.kind}
                onChange={(e) => line(i, "kind", e.target.value)}
              >
                {Object.entries(kinds).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Text
              label="Descripción *"
              value={it.description}
              required
              max={1000}
              onChange={(v) => line(i, "description", v)}
            />
          </div>
          <div className="grid four">
            <Text
              label="Cantidad *"
              value={it.quantity}
              required
              onChange={(v) => line(i, "quantity", v)}
            />
            <Text
              label="Unidad *"
              value={it.unit}
              required
              max={40}
              onChange={(v) => line(i, "unit", v)}
            />
            <Text
              label="Precio unitario ARS *"
              value={it.unitPrice}
              required
              onChange={(v) => line(i, "unitPrice", v)}
            />
            <Field label="Descuento">
              <select
                value={it.discountType}
                onChange={(e) => {
                  const items = q.items.map((it, j) =>
                    j === i
                      ? {
                        ...it,
                        discountType: e.target.value,
                        discountValue: "0",
                      }
                      : it,
                  );
                  change("items", items);
                }}
              >
                <option value="NONE">Sin descuento</option>
                <option value="AMOUNT">Importe ARS</option>
                <option value="PERCENT">Porcentaje %</option>
              </select>
            </Field>
          </div>
          {it.discountType !== "NONE" && (
            <Text
              label={
                it.discountType === "PERCENT"
                  ? "Porcentaje de descuento"
                  : "Descuento ARS del renglón"
              }
              value={it.discountValue}
              onChange={(v) => line(i, "discountValue", v)}
            />
          )}
        </article>
      ))}
      <button
        type="button"
        onClick={() => change("items", [...q.items, newItem()])}
      >
        + Concepto manual / repuesto
      </button>
      <div className="grid two">
        <Field label="Descuento general">
          <select
            value={q.discountType}
            onChange={(e) => {
              update({ discountType: e.target.value, discountValue: "0" });
            }}
          >
            <option value="NONE">Sin descuento</option>
            <option value="AMOUNT">Importe ARS</option>
            <option value="PERCENT">Porcentaje %</option>
          </select>
        </Field>
        {q.discountType !== "NONE" && (
          <Text
            label="Valor de descuento general"
            value={q.discountValue}
            onChange={(v) => change("discountValue", v)}
          />
        )}
        <Text
          label="Total manual ARS (opcional)"
          value={q.manualTotal || ""}
          onChange={(v) => change("manualTotal", v)}
        />
        <Text
          label="Motivo del ajuste (obligatorio si hay total manual)"
          value={q.adjustmentReason}
          required={!!q.manualTotal}
          onChange={(v) => change("adjustmentReason", v)}
        />
        <Text
          label="Emisión"
          type="date"
          value={q.issueDate}
          onChange={(v) => {
            update({ issueDate: v, expiryDate: v ? expiryDate(v) : "" });
          }}
        />
        <Text
          label="Vencimiento editable"
          type="date"
          value={q.expiryDate}
          onChange={(v) => change("expiryDate", v)}
        />
        <Text
          label="Plazo de realización *"
          value={q.leadTime}
          required
          max={500}
          onChange={(v) => change("leadTime", v)}
        />
        <Text
          label="Seña sugerida %"
          value={q.depositPercent}
          onChange={(v) => change("depositPercent", v)}
        />
      </div>
      <Text
        label="Condiciones"
        long
        max={6000}
        value={q.conditions}
        onChange={(v) => change("conditions", v)}
      />
      <p className="muted">
        Vencimiento sugerido: cinco días de lunes a viernes, excluyendo emisión.
        No se consideran feriados.
      </p>
      <button
        type="button"
        onClick={calculate}
      >
        Calcular importes
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {calc && (
        <div className="totals">
          <span>Subtotal {money(calc.subtotal)}</span>
          <span>Descuento {money(calc.discount)}</span>
          <span>Ajuste {money(calc.adjustment)}</span>
          <strong>Total {money(calc.total)}</strong>
        </div>
      )}
    </Form>
  );
}
