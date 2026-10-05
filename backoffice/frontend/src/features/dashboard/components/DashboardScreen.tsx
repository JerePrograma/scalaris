import type { Dashboard } from "../types";
import type { Case } from "../../cases/types";
import { CaseList } from "../../cases/components/CaseList";
import { money } from "../../../shared/format";

export function DashboardScreen({
  dash,
  onNewCase,
  onCases,
  onOpen,
}: {
  dash?: Dashboard;
  onNewCase: () => void;
  onCases: (status?: string) => void;
  onOpen: (c: Case) => void;
}) {
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">SCALARIS · BUENOS AIRES</p>
          <h1>El trabajo, en orden.</h1>
          <p>Consultas, presupuestos y entregas en un solo lugar.</p>
        </div>
        <button className="primary" onClick={onNewCase}>
          + Nueva consulta
        </button>
      </div>
      <div className="grid three metrics">
        <button
          onClick={() => onCases("OPEN")}
        >
          <span>Trabajos pendientes</span>
          <strong>{dash?.pendingCases || 0}</strong>
          <small>Consultas y trabajos abiertos</small>
        </button>
        <button
          onClick={() => onCases("READY")}
        >
          <span>Listos para entregar</span>
          <strong>
            {dash?.counts.find((c) => c.status === "READY")?.count || 0}
          </strong>
          <small>Coordinar la entrega</small>
        </button>
        <article>
          <span>Saldos pendientes</span>
          <strong>{money(dash?.balances.balance || "0")}</strong>
          <small>
            {dash?.balances.pending || 0} casos con saldo · ARS
          </small>
        </article>
      </div>
      <section className="panel">
        <div className="row between">
          <h2>Actividad reciente</h2>
          <button onClick={() => onCases()}>Ver todas</button>
        </div>
        <CaseList cases={dash?.recent || []} onOpen={onOpen} />
      </section>
      <div className="notice">
        <strong>Servicio sin autenticación.</strong> Toda persona con
        acceso a esta red y al servicio puede consultar y modificar
        datos. Los registros son anónimos y no verifican quién hizo el
        cambio.
      </div>
    </>
  );
}
