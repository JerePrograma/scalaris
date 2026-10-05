export interface Event {
  id: number;
  type: string;
  entity: string;
  entity_id: number;
  data: unknown;
  occurred_at: string;
  origin: string;
}
