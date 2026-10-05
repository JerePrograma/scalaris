import type { Detail } from "../types";
import { Empty } from "../../../shared/components";
import { money } from "../../../shared/format";

export function PaymentsPanel({
  payments,
  onReverse,
}: {
  payments: Detail["payments"];
  onReverse: (paymentId: number) => void;
}) {
  return (
    <section className="panel">
      <h2>Cobros manuales</h2>
      {!payments.length ? (
        <Empty>
          Sin pagos registrados. La falta de seña genera advertencia.
        </Empty>
      ) : (
        payments.map((p) => (
          <article key={p.id} className="payment">
            <strong>
              {p.reverses_id ? "Contrapartida −" : "Pago +"}
              {money(p.amount)}
            </strong>
            <p>
              {p.paid_date} · {p.method} · {p.reference}
              <br />
              {p.note}
            </p>
            {!p.reverses_id &&
              !payments.some((r) => r.reverses_id === p.id) && (
                <button
                  onClick={() => onReverse(p.id)}
                >
                  Anular con motivo
                </button>
              )}
          </article>
        ))
      )}
    </section>

  );
}
