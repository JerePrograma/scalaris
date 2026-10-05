import { services, states } from "../labels";
import type { Case } from "../types";
import { when } from "../../../shared/format";
import { Empty } from "../../../shared/components";

export function CaseList({
  cases,
  onOpen,
}: {
  cases: Case[];
  onOpen: (c: Case) => void;
}) {
  if (!cases.length)
    return (
      <Empty>
        No hay consultas en esta vista. Creá una nueva o revisá los filtros.
      </Empty>
    );
  return (
    <div className="case-list">
      {cases.map((c) => (
        <button className="case-row" key={c.id} onClick={() => onOpen(c)}>
          <span className="case-number">#{c.number}</span>
          <span>
            <strong>{c.data.title}</strong>
            <small>
              {c.client?.name} · {services[c.service]}
            </small>
          </span>
          <span className={"badge " + c.status.toLowerCase()}>
            {states[c.status]}
          </span>
          <span className="case-date">{when(c.created_at)}</span>
          <span aria-hidden="true">→</span>
        </button>
      ))}
    </div>
  );
}
