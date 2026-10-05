import { api } from "../../shared/api/http";
import type { Catalog } from "./types";

export const listCatalog = () => api<Catalog[]>("/catalog");
export const saveCatalogEntry = (
  data: Pick<Catalog, "description" | "kind" | "unit" | "price" | "active">,
  entry?: Catalog,
) => api(entry ? "/catalog/" + entry.id : "/catalog", entry ? "PUT" : "POST", {
  ...data, ...(entry ? { version: entry.version } : {}),
});
