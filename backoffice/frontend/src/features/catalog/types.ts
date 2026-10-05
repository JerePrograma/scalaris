export interface Catalog {
  id: number;
  version: number;
  description: string;
  kind: string;
  unit: string;
  price: string;
  active: boolean;
  source: string;
}
