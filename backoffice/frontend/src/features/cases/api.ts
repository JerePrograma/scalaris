import { api } from "../../shared/api/http";
import type { Case, CaseFilter, Detail, PaymentRequest, WorkData } from "./types";
import type { Data } from "../../shared/types";

export function listCases(filter: CaseFilter) {
  const params = new URLSearchParams();
  Object.entries(filter).forEach(([key, value]) => {
    if (value !== "" && value !== 0) params.set(key, String(value));
  });
  return api<Case[]>("/cases?" + params);
}
export const loadCase = (id: number) => api<Detail>("/cases/" + id);
export const saveCase = (clientId: string, service: string, data: Data, entry?: Case) =>
  api<Case>(entry ? "/cases/" + entry.id : "/cases", entry ? "PUT" : "POST", {
    clientId: Number(clientId),
    ...(entry ? { version: entry.version } : { service }),
    data,
  });
export const transitionCase = (entry: Case, status: string, reason: string, correction: boolean) =>
  api("/cases/" + entry.id + "/transition", "POST", {
    status, reason, correction, version: entry.version,
  });
export const recordPayment = (caseId: number, data: PaymentRequest) =>
  api("/cases/" + caseId + "/payments", "POST", data);
export const reversePayment = (caseId: number, paymentId: number, reason: string) =>
  api(`/cases/${caseId}/payments/${paymentId}/reverse`, "POST", { reason });
export const saveWork = (caseId: number, work: WorkData, version: number) =>
  api("/cases/" + caseId + "/work", "PUT", { ...work, version });
export const addCaseNote = (caseId: number, text: string) =>
  api("/cases/" + caseId + "/notes", "POST", { text });
export function uploadAttachment(caseId: number, file: File) {
  const body = new FormData();
  body.append("file", file);
  return api("/cases/" + caseId + "/attachments", "POST", body);
}
