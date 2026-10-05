import { uploadAttachment } from "../api";
import type { Detail } from "../types";
import { Form, Field } from "../../../shared/components";

export function AttachmentsPanel({
  id,
  attachments,
  load,
}: {
  id: number;
  attachments: Detail["attachments"];
  load: () => Promise<void>;
}) {
  return (
    <section className="panel">
      <h2>Fotos y archivos</h2>
      <p className="muted">
        JPG, PNG, PDF sin acciones ni formularios, TXT UTF-8. Hasta 8 MB por
        archivo, 20 por caso. Sin credenciales.
      </p>
      <Form
        label="Subir adjunto"
        onSubmit={async () => {
          const element =
            document.querySelector<HTMLInputElement>("#attachment");
          if (!element?.files?.[0]) throw new Error("Elegí un archivo.");
          await uploadAttachment(id, element.files[0]);
          element.value = "";
          await load();
        }}
      >
        <Field label="Adjunto">
          <input
            id="attachment"
            type="file"
            required
            accept="image/jpeg,image/png,application/pdf,text/plain"
          />
        </Field>
      </Form>
      {attachments.map((a) => (
        <p key={a.id}>
          <a href={"/api/attachments/" + a.id}>{a.original_name}</a> ·{" "}
          {Math.ceil(a.size / 1024)} KB
        </p>
      ))}
    </section>

  );
}
