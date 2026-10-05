import { useState } from "react";
import { previewImport, confirmImport } from "../api";
import type { ImportPreview } from "../types";
import { services } from "../../cases/labels";
import type { Case } from "../../cases/types";
import type { Client } from "../../clients/types";
import { Form, Field, Empty } from "../../../shared/components";

export function ImportView({
  clients,
  onSaved,
}: {
  clients: Client[];
  onSaved: (c: Case) => void;
}) {
  const [preview, set] = useState<ImportPreview>(),
    [error, setError] = useState(""),
    [clientId, setClient] = useState("");
  return (
    <>
      <p>
        La ficha se importa manualmente. No existe sincronización con el sitio
        público. Se valida versión, campos, tamaño y duplicados antes de crear
        una consulta.
      </p>
      <Field label="Ficha JSON v1 (hasta 32 KB)">
        <input
          type="file"
          accept="application/json,.json"
          onChange={async (e) => {
            set(undefined);
            setError("");
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              if (file.size > 32768) throw new Error("La ficha supera 32 KB.");
              const parsed: unknown = JSON.parse(await file.text());
              set(await previewImport(parsed));
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        />
      </Field>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!preview ? (
        <Empty>
          Seleccioná la ficha que recibiste del cliente para revisarla.
        </Empty>
      ) : (
        <>
          <h3>Vista previa · {services[preview.inquiry.service]}</h3>
          <p>
            <strong>{preview.inquiry.contact.name}</strong> ·{" "}
            {preview.inquiry.contact.phone || "Sin teléfono"}
          </p>
          <dl>
            {Object.entries(preview.inquiry.answers)
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt>
                    {
                      (
                        {
                          topic: "Consulta",
                          type: "Tipo",
                          model: "Marca/modelo",
                          problem: "Problema",
                          since: "Desde cuándo",
                          need: "Necesidad",
                          scope: "Alcance",
                          requirements: "Requisitos",
                          deadline: "Plazo solicitado",
                          part: "Repuesto",
                          compatibility: "Compatibilidad",
                        } as Record<string, string>
                      )[k]
                    }
                  </dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
          {preview.duplicates.length ? (
            <p className="error">
              Ya importada en consulta #{preview.duplicates[0].case_number}. No se
              creará otra copia.
            </p>
          ) : (
            <Form
              label="Confirmar importación"
              onSubmit={async () =>
                onSaved(
                  await confirmImport(preview.inquiry, clientId),
                )
              }
            >
              <Field label="Asociar cliente">
                <select
                  value={clientId}
                  onChange={(e) => setClient(e.target.value)}
                >
                  <option value="">Crear cliente con estos datos</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.data.name}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="notice">
                Revisá el cliente seleccionado. Al confirmar se crea la consulta
                y su registro de importación.
              </p>
            </Form>
          )}
        </>
      )}
    </>
  );
}
