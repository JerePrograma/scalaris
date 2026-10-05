import { useEffect, useState } from "react";
import { listClients } from "../features/clients/api";
import { listCatalog } from "../features/catalog/api";
import { loadDashboard } from "../features/dashboard/api";
import { listCases } from "../features/cases/api";
import { listAudit } from "../features/audit/api";
import type { Client } from "../features/clients/types";
import type { Catalog } from "../features/catalog/types";
import type { Case, CaseFilter } from "../features/cases/types";
import type { Dashboard } from "../features/dashboard/types";
import type { Event } from "../features/audit/types";

export function useBackofficeData({
  tab,
  caseId,
  filter,
  clientSearch,
  auditOffset,
}: {
  tab: string;
  caseId?: number;
  filter: CaseFilter;
  clientSearch: string;
  auditOffset: number;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [catalog, setCatalog] = useState<Catalog[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [dash, setDash] = useState<Dashboard>();
  const [audit, setAudit] = useState<Event[]>([]);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const [cl, ca, da] = await Promise.all([
        listClients(),
        listCatalog(),
        loadDashboard(),
      ]);
      setClients(cl);
      setCatalog(ca);
      setDash(da);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => {
    if (tab !== "cases" || caseId) return;
    let alive = true;
    listCases(filter)
      .then((r) => {
        if (alive) setCases(r);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [tab, filter, caseId]);
  useEffect(() => {
    if (tab !== "audit") return;
    listAudit(auditOffset)
      .then(setAudit)
      .catch((e) => setError(e.message));
  }, [tab, auditOffset]);
  useEffect(() => {
    if (tab !== "clients") return;
    const t = setTimeout(() => {
      listClients(clientSearch)
        .then(setClients)
        .catch((e) => setError(e.message));
    }, 200);
    return () => clearTimeout(t);
  }, [clientSearch, tab]);

  return {
    clients, catalog, cases, dash, audit, error, refresh,
    clearError: () => setError(""),
    prependClient: (client: Client) => setClients([client, ...clients]),
  };
}
