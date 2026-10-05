import { useState } from "react";
import { saveWork } from "../api";
import type { Detail } from "../types";
import { Form, Text } from "../../../shared/components";

export function WorkEditor({
  detail: d,
  done,
}: {
  detail: Detail;
  done: () => void;
}) {
  const [work, set] = useState(d.work!.data);
  return (
    <Form
      onSubmit={async () => {
        await saveWork(d.case.id, work, d.work!.version);
        done();
      }}
    >
      {work.tasks.map((task, i) => (
        <div className="row task-edit" key={i}>
          <input
            type="checkbox"
            aria-label={"Completada " + task.text}
            checked={task.done}
            onChange={(e) =>
              set({
                ...work,
                tasks: work.tasks.map((t, j) =>
                  j === i ? { ...t, done: e.target.checked } : t,
                ),
              })
            }
          />
          <input
            aria-label={"Tarea " + (i + 1)}
            value={task.text}
            required
            maxLength={1000}
            onChange={(e) =>
              set({
                ...work,
                tasks: work.tasks.map((t, j) =>
                  j === i ? { ...t, text: e.target.value } : t,
                ),
              })
            }
          />
          <button
            type="button"
            onClick={() =>
              set({ ...work, tasks: work.tasks.filter((_, j) => i !== j) })
            }
          >
            Quitar
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          set({ ...work, tasks: [...work.tasks, { text: "", done: false }] })
        }
      >
        + Tarea
      </button>
      <Text
        label="Avances"
        value={work.progress}
        max={6000}
        long
        onChange={(v) => set({ ...work, progress: v })}
      />
      <Text
        label="Horas reales (no modifican importe)"
        value={work.actualHours}
        onChange={(v) => set({ ...work, actualHours: v })}
      />
      <Text
        label="Recepción"
        long
        max={6000}
        value={work.reception}
        onChange={(v) => set({ ...work, reception: v })}
      />
      <Text
        label="Entrega / constancia manual"
        max={6000}
        long
        value={work.delivery}
        onChange={(v) => set({ ...work, delivery: v })}
      />
    </Form>
  );
}
