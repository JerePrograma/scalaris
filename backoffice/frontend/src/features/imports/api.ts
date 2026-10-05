import { api } from "../../shared/api/http";
import type { Case } from "../cases/types";
import type { Inquiry, ImportPreview } from "./types";

export const previewImport = (parsed: unknown) => api<ImportPreview>("/imports/preview", "POST", parsed);
export const confirmImport = (inquiry: Inquiry, clientId: string) =>
  api<Case>("/imports/confirm", "POST", {
    inquiry, ...(clientId ? { clientId: Number(clientId) } : {}),
  });
