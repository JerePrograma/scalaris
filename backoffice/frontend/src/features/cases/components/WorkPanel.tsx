import type { Detail, WorkData } from "../types";
import { Empty } from "../../../shared/components";

export function WorkPanel({
  detail: d,
  onEdit,
}: {
  detail: Detail;
  onEdit: () => void;
}) {
  return (
    <section className="panel">
      <div className="row between">
        <h2>Orden de trabajo</h2>
        {d.work && (
          <button onClick={onEdit}>
            Editar tareas / recepción / entrega
          </button>
        )}
      </div>
      {!d.work ? (
        <Empty>
          La orden se crea al aceptar una revisión exacta del presupuesto.
        </Empty>
      ) : (
        <>
          <p>
            Vinculada a la revisión aceptada R
            {d.revisions.find((r) => r.id === d.work?.revision_id)?.revision}{" "}
            · Horas reales: {d.work.data.actualHours}. No cambian el importe.
          </p>
          <ul className="task-list">
            {d.work.data.tasks.map((t, i) => (
              <li key={i}>
                {t.done ? "✓" : "○"} {t.text}
              </li>
            ))}
          </ul>
          <dl>
            {["progress", "reception", "delivery"].map((k) => (
              <div key={k}>
                <dt>
                  {
                    {
                      progress: "Avances",
                      reception: "Recepción",
                      delivery: "Entrega",
                    }[k]
                  }
                </dt>
                <dd>
                  {(d.work?.data[k as keyof WorkData] as string) ||
                    "Sin registro"}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>

  );
}
