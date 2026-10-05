import type { Client } from "../types";
import { Field, Empty } from "../../../shared/components";

export function ClientsScreen({
  clients,
  clientSearch,
  setClientSearch,
  onNew,
  onEdit,
  onCases,
}: {
  clients: Client[];
  clientSearch: string;
  setClientSearch: (value: string) => void;
  onNew: () => void;
  onEdit: (client: Client) => void;
  onCases: (client: Client) => void;
}) {
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">RELACIONES</p>
          <h1>Clientes</h1>
        </div>
        <button
          className="primary"
          onClick={onNew}
        >
          + Nuevo cliente
        </button>
      </div>
      <Field label="Buscar nombre o teléfono">
        <input
          value={clientSearch}
          onChange={(e) => setClientSearch(e.target.value)}
          placeholder="Buscar cliente"
        />
      </Field>
      <div className="grid two">
        {clients.map((c) => (
          <article className="panel" key={c.id}>
            <h2>{c.data.name}</h2>
            <p>
              {c.data.phone || "Sin teléfono"}
              <br />
              {c.data.email}
              <br />
              {c.data.address}
            </p>
            {c.data.notes && <p>{c.data.notes}</p>}
            <div className="actions">
              <button
                onClick={() => onEdit(c)}
              >
                Editar
              </button>
              <button
                onClick={() => onCases(c)}
              >
                Ver consultas
              </button>
            </div>
          </article>
        ))}
      </div>
      {!clients.length && (
        <Empty>
          Registrá un nombre o identificación útil. El resto de los
          datos es opcional.
        </Empty>
      )}
    </>
  );
}
