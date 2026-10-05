import { useEffect, useState } from "react";
import { loadCase } from "../api";
import type { Detail } from "../types";

export function useCaseDetail(id: number) {
  const [detail, setDetail] = useState<Detail>();
  const [error, setError] = useState("");
  async function load() {
    try { setDetail(await loadCase(id)); setError(""); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { void load(); }, [id]);
  return { detail, error, load };
}
