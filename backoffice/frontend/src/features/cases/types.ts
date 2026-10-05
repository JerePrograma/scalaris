import type { Data } from "../../shared/types";
import type { Client } from "../clients/types";
import type { Revision } from "../quotes/types";
import type { Event } from "../audit/types";

export interface Case {
  id: number;
  number: number;
  version: number;
  client_id: number;
  service: string;
  status: string;
  data: Data;
  created_at: string;
  client?: Data;
  accepted_revision_id: number | null;
}
export interface WorkData {
  tasks: { text: string; done: boolean }[];
  progress: string;
  actualHours: string;
  reception: string;
  delivery: string;
}
export interface Detail {
  case: Case;
  client: Client;
  revisions: Revision[];
  work: { version: number; revision_id: number; data: WorkData } | null;
  balance: { total: string; paid: string; balance: string; status: string };
  payments: {
    id: number;
    amount: string;
    paid_date: string;
    method: string;
    reference: string;
    note: string;
    reverses_id: number | null;
  }[];
  attachments: {
    id: number;
    original_name: string;
    mime: string;
    size: number;
  }[];
  events: Event[];
}
export interface CaseFilter {
  q: string;
  status: string;
  service: string;
  from: string;
  to: string;
  clientId: string;
  offset: number;
}

export interface PaymentRequest {
  amount: string;
  date: string;
  method: string;
  reference: string;
  note: string;
  operationKey: string;
}
