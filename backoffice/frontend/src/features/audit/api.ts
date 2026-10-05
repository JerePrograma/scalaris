import { api } from "../../shared/api/http";
import type { Event } from "./types";

export const listAudit = (offset: number) => api<Event[]>("/audit?offset=" + offset);
