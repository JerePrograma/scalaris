import {
  useState,
  useId,
  cloneElement,
  isValidElement,
  type ReactElement,
  type FormEvent,
  type ReactNode,
} from "react";
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <label className="field">
      <span id={id}>{label}</span>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          "aria-labelledby": id,
        })
        : children}
    </label>
  );
}
export function Text({
  label,
  value,
  onChange,
  required = false,
  long = false,
  type = "text",
  max = 3000,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  long?: boolean;
  type?: string;
  max?: number;
}) {
  return (
    <Field label={label}>
      {long ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          maxLength={max}
          rows={3}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          type={type}
          step={type === "datetime-local" ? "any" : undefined}
          maxLength={max}
        />
      )}
    </Field>
  );
}
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row between">
          <h2>{title}</h2>
          <button onClick={onClose} type="button" aria-label="Cerrar">
            Cerrar ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function Form({
  onSubmit,
  children,
  label = "Guardar",
  cancel,
}: {
  onSubmit: () => Promise<unknown>;
  children: ReactNode;
  label?: string;
  cancel?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      {children}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button className="primary" disabled={busy} type="submit">
          {busy ? "Guardando…" : label}
        </button>
        {cancel && (
          <button onClick={cancel} type="button">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function JsonView({ data }: { data: unknown }) {
  return <pre className="json">{JSON.stringify(data, null, 2)}</pre>;
}
