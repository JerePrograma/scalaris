import type { Case } from "../cases/types";

export interface Dashboard {
  counts: { status: string; count: number }[];
  pendingCases: number;
  balances: { balance: string; pending: number };
  recent: Case[];
}
