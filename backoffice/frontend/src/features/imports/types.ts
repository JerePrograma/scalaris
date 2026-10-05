export interface Inquiry {
  schema: string;
  version: number;
  id: string;
  service: string;
  contact: { name: string; phone: string };
  answers: Record<string, string>;
}
export interface ImportPreview {
  inquiry: Inquiry;
  duplicates: { case_id: number; case_number: number }[];
}
