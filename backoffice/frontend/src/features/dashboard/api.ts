import { api } from "../../shared/api/http";
import type { Dashboard } from "./types";

export const loadDashboard = () => api<Dashboard>("/dashboard");
