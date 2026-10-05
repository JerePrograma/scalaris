import type { Data } from "../../shared/types";

export interface Client {
  id: number;
  version: number;
  data: Data;
}
