import { api } from "../../shared/api/http";
import type { Client } from "./types";
import type { Data } from "../../shared/types";

export const listClients = (q?: string) =>
  api<Client[]>(q === undefined ? "/clients" : "/clients?q=" + encodeURIComponent(q));
export const saveClient = (data: Data, client?: Client) =>
  api<Client>(client ? "/clients/" + client.id : "/clients", client ? "PUT" : "POST", {
    ...data, ...(client ? { version: client.version } : {}),
  });
