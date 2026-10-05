import type { Dispatch, SetStateAction } from "react";
import { states, services } from "../labels";
import type { Case, CaseFilter } from "../types";
import type { Client } from "../../clients/types";
import { CaseList } from "./CaseList";
import { Field } from "../../../shared/components";

export function CasesScreen({
  cases,
  clients,
  filter,
  setFilter,
  onNewCase,
  onOpen,
}: {
  cases: Case[];
  clients: Client[];
  filter: CaseFilter;
  setFilter: Dispatch<SetStateAction<CaseFilter>>;
  onNewCase: () => void;
  onOpen: (c: Case) => void;
}) {
  const change = (key: string, value: string) => setFilter({ ...filter, [key]: value, offset: 0 });
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">SEGUIMIENTO</p>
          <h1>Consultas y trabajos</h1>
        </div>
        <button className="primary" onClick={onNewCase}>
          + Nueva consulta
        </button>
      </div>
      <section className="panel filters">
        <Field label="Buscar por cliente, número o detalle">
          <input
            value={filter.q}
            onChange={(e) => change("q", e.target.value)}
            placeholder="Nombre, # o servicio…"
            maxLength={300}
          />
        </Field>
        <div className="grid four">
          <Field label="Servicio">
            <select
              value={filter.service}
              onChange={(e) => change("service", e.target.value)}
            >
              <option value="">Todos</option>
              {Object.entries(services).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estado">
            <select
              value={filter.status}
              onChange={(e) => change("status", e.target.value)}
            >
              <option value="">Todos</option>
              <option value="OPEN">Abiertos / pendientes</option>
              {Object.entries(states).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Desde">
            <input
              type="date"
              value={filter.from}
              onChange={(e) => change("from", e.target.value)}
            />
          </Field>
          <Field label="Hasta">
            <input
              type="date"
              value={filter.to}
              onChange={(e) => change("to", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Cliente">
          <select
            value={filter.clientId}
            onChange={(e) => change("clientId", e.target.value)}
          >
            <option value="">Todos los clientes</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.data.name}
              </option>
            ))}
          </select>
        </Field>
        <button
          onClick={() =>
            setFilter({
              q: "",
              status: "",
              service: "",
              from: "",
              to: "",
              clientId: "",
              offset: 0,
            })
          }
        >
          Limpiar filtros
        </button>
      </section>
      <section className="panel">
        <CaseList cases={cases} onOpen={onOpen} />
        <div className="actions">
          <button
            disabled={!filter.offset}
            onClick={() =>
              setFilter({
                ...filter,
                offset: Math.max(0, filter.offset - 100),
              })
            }
          >
            Anterior
          </button>
          <button
            disabled={cases.length < 100}
            onClick={() =>
              setFilter({ ...filter, offset: filter.offset + 100 })
            }
          >
            Siguiente
          </button>
        </div>
      </section>
    </>
  );
}
