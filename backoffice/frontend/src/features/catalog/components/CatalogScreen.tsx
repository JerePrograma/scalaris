import type { Catalog } from "../types";
import { money } from "../../../shared/format";

export function CatalogScreen({
  catalog,
  onNew,
  onEdit,
}: {
  catalog: Catalog[];
  onNew: () => void;
  onEdit: (entry: Catalog) => void;
}) {
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">TARIFAS EDITABLES · ARS</p>
          <h1>Catálogo de conceptos</h1>
        </div>
        <button
          className="primary"
          onClick={onNew}
        >
          + Nuevo concepto
        </button>
      </div>
      <p className="notice">
        Mano de obra inicial: referencia VidaInformática
        Freelance/Taller, sin fecha de vigencia atribuida. Repuestos y
        SSD del combo se cobran aparte. No incluye licencias
        comerciales; deben ser legítimas y provistas/autorizadas.
      </p>
      <div className="catalog-list">
        {catalog.map((c) => (
          <article className="panel row between" key={c.id}>
            <div>
              <h3>{c.description}</h3>
              <p>
                {c.unit} · {c.active ? "Activo" : "Desactivado"} ·{" "}
                {
                  {
                    LABOR: "Mano de obra",
                    PART: "Repuesto",
                    OTHER: "Otro",
                  }[c.kind]
                }
              </p>
              <small>{c.source}</small>
            </div>
            <div>
              <p className="amount">{money(c.price)}</p>
              <button
                onClick={() => onEdit(c)}
              >
                Editar
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
