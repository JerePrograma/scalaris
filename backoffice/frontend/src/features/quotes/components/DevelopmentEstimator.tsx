import { useState } from "react";
import { Field } from "../../../shared/components";
import { money } from "../../../shared/format";
import type { Catalog } from "../../catalog/types";

const options = [
  { title: "Automatización simple", hours: 4 },
  { title: "Landing page", hours: 4 },
  { title: "Sitio institucional de hasta 5 secciones", hours: 8 },
  { title: "Tienda o catálogo online", hours: 16 },
  { title: "Integración con API", hours: 8 },
  { title: "Ajuste sobre un sitio existente", hours: 2 },
];

export function DevelopmentEstimator({
  catalog,
  onAdd,
}: {
  catalog: Catalog[];
  onAdd: (estimate: { title: string; hours: number; unitPrice: string }) => void;
}) {
  const [selectedTitle, setSelectedTitle] = useState("");
  const selected = options.find((option) => option.title === selectedTitle);
  const hourly = catalog.find(
    (entry) => entry.active && entry.unit === "hora",
  );
  const hourlyPrice = Number(hourly?.price);

  return (
    <section className="notice" aria-label="Estimación mínima de desarrollo">
      <h3>Estimación mínima de desarrollo</h3>
      <p>
        Es un mínimo aproximado para orientar el presupuesto. El alcance y las
        horas pueden cambiar después del relevamiento.
      </p>
      <Field label="Tipo de desarrollo">
        <select
          value={selectedTitle}
          onChange={(event) => setSelectedTitle(event.target.value)}
        >
          <option value="">Seleccionar una opción</option>
          {options.map((option) => (
            <option key={option.title} value={option.title}>
              {option.title}
            </option>
          ))}
        </select>
      </Field>
      {selected && hourly && Number.isFinite(hourlyPrice) ? (
        <>
          <p role="status">
            Mínimo aproximado: <strong>{selected.hours} horas</strong>. Tarifa
            actual: {money(hourlyPrice)} por hora. Total orientativo: {" "}
            <strong>{money(hourlyPrice * selected.hours)}</strong>
          </p>
          <button
            type="button"
            onClick={() =>
              onAdd({
                title: selected.title,
                hours: selected.hours,
                unitPrice: hourly.price,
              })
            }
          >
            Agregar mínimo estimado al presupuesto
          </button>
        </>
      ) : selected ? (
        <p className="muted">
          Activá en el catálogo una tarifa con unidad “hora” para calcular el
          importe orientativo.
        </p>
      ) : null}
    </section>
  );
}
