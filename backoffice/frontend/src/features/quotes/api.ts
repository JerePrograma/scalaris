import { api } from "../../shared/api/http";
import { quoteRequest } from "./draft";
import type { Calculation, Quote, Revision } from "./types";

export const calculateQuote = (quote: Quote) =>
  api<Calculation>("/quotes/calculate", "POST", quoteRequest(quote));
export const saveRevision = (caseId: number, quote: Quote, edit?: boolean, source?: Revision) =>
  api(
    "/cases/" + caseId + "/revisions" + (edit && source ? "/" + source.id : ""),
    edit ? "PUT" : "POST",
    { ...quoteRequest(quote), ...(edit && source ? { version: source.version } : {}) },
  );
export const sendRevision = (caseId: number, revision: Revision) =>
  api(`/cases/${caseId}/revisions/${revision.id}/send`, "POST", { version: revision.version });
export const acceptRevision = (
  caseId: number, revision: Revision, channel: string, note: string, date: string,
) => api(`/cases/${caseId}/revisions/${revision.id}/accept`, "POST", {
  version: revision.version,
  channel,
  note,
  date: (date.length === 16 ? date + ":00" : date) + "-03:00",
});
