import { useState } from "react";
import type { Client } from "./features/clients/types";
import type { Catalog } from "./features/catalog/types";
import type { Case, CaseFilter } from "./features/cases/types";
import { Dialog } from "./shared/components";
import { ClientEditor } from "./features/clients/components/ClientEditor";
import { CatalogEditor } from "./features/catalog/components/CatalogEditor";
import { CaseEditor } from "./features/cases/components/CaseEditor";
import { CaseView } from "./features/cases/components/CaseView";
import { DashboardScreen } from "./features/dashboard/components/DashboardScreen";
import { CasesScreen } from "./features/cases/components/CasesScreen";
import { ClientsScreen } from "./features/clients/components/ClientsScreen";
import { CatalogScreen } from "./features/catalog/components/CatalogScreen";
import { ImportScreen } from "./features/imports/components/ImportScreen";
import { AuditScreen } from "./features/audit/components/AuditScreen";
import { useBackofficeData } from "./app/useBackofficeData";

export default function App() {
  const [tab, setTab] = useState("dashboard"),
    [caseId, setCaseId] = useState<number>(),
    [modal, setModal] = useState(""),
    [client, setClient] = useState<Client>(),
    [entry, setEntry] = useState<Catalog>(),
    [filter, setFilter] = useState<CaseFilter>({
      q: "",
      status: "",
      service: "",
      from: "",
      to: "",
      clientId: "",
      offset: 0,
    }),
    [clientSearch, setClientSearch] = useState(""),
    [auditOffset, setAuditOffset] = useState(0);
  const { clients, catalog, cases, dash, audit, error, refresh, clearError, prependClient } =
    useBackofficeData({ tab, caseId, filter, clientSearch, auditOffset });
  function navigate(next: string) {
    setTab(next);
    setCaseId(undefined);
    clearError();
    void refresh();
  }
  function open(c: Case) {
    setCaseId(c.id);
    setTab("cases");
  }
  function done() {
    setModal("");
    void refresh();
    setFilter({ ...filter });
  }
  function change(k: string, v: string) {
    setFilter({ ...filter, [k]: v, offset: 0 });
  }
  return (
    <div className="app">
      <aside>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("dashboard");
          }}
        >
          <img src="/assets/logo-dark.svg" alt="Scalaris" />
        </a>
        <span className="workspace">BACKOFFICE LOCAL</span>
        <nav aria-label="Backoffice">
          {Object.entries({
            dashboard: "Tablero",
            cases: "Consultas y trabajos",
            clients: "Clientes",
            catalog: "Catálogo",
            import: "Importar ficha",
            audit: "Trazabilidad",
          }).map(([k, v]) => (
            <button
              className={tab === k ? "selected" : ""}
              key={k}
              onClick={() => navigate(k)}
            >
              {v}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          Sin login
          <br />
          Acceso para toda persona que alcance el servicio en tu red.
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>Tu tecnología, en buenas manos.</span>
          <span className="online">● Operación manual</span>
        </header>
        <div className="content">
          {error && (
            <div role="alert" className="error">
              {error}
              <button onClick={() => void refresh()}>Reintentar</button>
            </div>
          )}
          {tab === "dashboard" && (
            <DashboardScreen
              dash={dash}
              onNewCase={() => setModal("case")}
              onCases={(status) => {
                navigate("cases");
                if (status) change("status", status);
              }}
              onOpen={open}
            />
          )}
          {tab === "cases" && (caseId ? (
            <CaseView
              id={caseId}
              clients={clients}
              catalog={catalog}
              onBack={() => setCaseId(undefined)}
              onChange={() => void refresh()}
            />
          ) : (
            <CasesScreen
              cases={cases}
              clients={clients}
              filter={filter}
              setFilter={setFilter}
              onNewCase={() => setModal("case")}
              onOpen={open}
            />
          ))}
          {tab === "clients" && (
            <ClientsScreen
              clients={clients}
              clientSearch={clientSearch}
              setClientSearch={setClientSearch}
              onNew={() => { setClient(undefined); setModal("client"); }}
              onEdit={(c) => { setClient(c); setModal("client"); }}
              onCases={(c) => {
                navigate("cases");
                setFilter({
                  q: "", status: "", service: "", from: "", to: "",
                  clientId: String(c.id), offset: 0,
                });
              }}
            />
          )}
          {tab === "catalog" && (
            <CatalogScreen
              catalog={catalog}
              onNew={() => { setEntry(undefined); setModal("catalog"); }}
              onEdit={(c) => { setEntry(c); setModal("catalog"); }}
            />
          )}
          {tab === "import" && (
            <ImportScreen clients={clients} onSaved={(c) => { void refresh(); open(c); }} />
          )}
          {tab === "audit" && (
            <AuditScreen audit={audit} auditOffset={auditOffset} setAuditOffset={setAuditOffset} />
          )}
          {modal && (
            <Dialog
              title={
                {
                  client: client ? "Editar cliente" : "Nuevo cliente",
                  catalog: entry ? "Editar concepto" : "Nuevo concepto",
                  case: "Nueva consulta",
                }[modal] || ""
              }
              onClose={() => setModal("")}
            >
              {modal === "client" && (
                <ClientEditor client={client} onSaved={done} />
              )}
              {modal === "catalog" && (
                <CatalogEditor entry={entry} onSaved={done} />
              )}
              {modal === "case" &&
                (clients.length ? (
                  <CaseEditor
                    clients={clients}
                    onSaved={(c) => {
                      done();
                      open(c);
                    }}
                  />
                ) : (
                  <>
                    <p>
                      Primero registrá un cliente con un nombre o identificación
                      útil.
                    </p>
                    <ClientEditor
                      onSaved={(c) => {
                        prependClient(c);
                        setModal("case");
                      }}
                    />
                  </>
                ))}
            </Dialog>
          )}
          <footer>
            Scalaris · Importes en ARS · Fechas en Buenos Aires · Sin conexión
            con el sitio público
          </footer>
        </div>
      </main>
    </div>
  );
}
