import type { Client } from "../../clients/types";
import type { Case } from "../../cases/types";
import { ImportView } from "./ImportView";

export function ImportScreen({
  clients,
  onSaved,
}: {
  clients: Client[];
  onSaved: (entry: Case) => void;
}) {
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">RECEPCIÓN MANUAL</p>
          <h1>Importar ficha de consulta</h1>
        </div>
      </div>
      <section className="panel">
        <ImportView
          clients={clients}
          onSaved={onSaved}
        />
      </section>
    </>
  );
}
