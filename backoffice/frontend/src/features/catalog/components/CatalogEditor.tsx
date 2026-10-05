import { useState } from "react";
import { saveCatalogEntry } from "../api";
import { kinds } from "../labels";
import type { Catalog } from "../types";
import { Form, Text, Field } from "../../../shared/components";

export function CatalogEditor({
  entry,
  onSaved,
}: {
  entry?: Catalog;
  onSaved: () => void;
}) {
  const [data, set] = useState({
    description: entry?.description || "",
    kind: entry?.kind || "LABOR",
    unit: entry?.unit || "servicio",
    price: entry?.price || "0",
    active: entry?.active ?? true,
  });
  return (
    <Form
      onSubmit={async () => {
        await saveCatalogEntry(data, entry);
        onSaved();
      }}
    >
      <Text
        label="Descripción *"
        value={data.description}
        required
        onChange={(v) => set({ ...data, description: v })}
        max={1000}
      />
      <div className="grid two">
        <Field label="Concepto">
          <select
            value={data.kind}
            onChange={(e) => set({ ...data, kind: e.target.value })}
          >
            {Object.entries(kinds).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Text
          label="Unidad *"
          value={data.unit}
          required
          max={40}
          onChange={(v) => set({ ...data, unit: v })}
        />
        <Text
          label="Precio inicial ARS *"
          value={data.price}
          required
          onChange={(v) => set({ ...data, price: v })}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={data.active}
            onChange={(e) => set({ ...data, active: e.target.checked })}
          />
          Servicio activo
        </label>
      </div>
      <p className="muted">
        Valores editables. Los presupuestos anteriores conservan sus importes.
        Los repuestos no representan stock.
      </p>
    </Form>
  );
}
