import { afterEach, test, expect, vi } from "vitest";
import { api } from "./http";

afterEach(() => vi.unstubAllGlobals());
test("API preserves decimal strings and mutation headers", async () => {
  const fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ total: "0.30" })),
  );
  vi.stubGlobal("fetch", fetch);
  const result = await api<{ total: string }>("/quotes/calculate", "POST", {
    quantity: "0.100",
    unitPrice: "3.00",
  });
  expect(result.total).toBe("0.30");
  expect(fetch).toHaveBeenCalledWith("/api/quotes/calculate", {
    method: "POST",
    headers: {
      "X-Scalaris-Request": "1",
      "Content-Type": "application/json",
    },
    body: '{"quantity":"0.100","unitPrice":"3.00"}',
  });
});
test("attachment request lets the browser choose its multipart boundary", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('{"id":1}'));
  vi.stubGlobal("fetch", fetch);
  const file = new FormData();
  file.append("file", new Blob(["nota"]), "nota.txt");
  await api("/cases/1/attachments", "POST", file);
  expect(fetch).toHaveBeenCalledWith("/api/cases/1/attachments", {
    method: "POST",
    headers: { "X-Scalaris-Request": "1" },
    body: file,
  });
});
test("API surfaces backend validation messages and handles non-JSON failures", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
    new Response('{"message":"El importe supera el saldo."}', { status: 400 }),
  ));
  await expect(api("/cases/1/payments", "POST", {})).rejects.toThrow(
    "El importe supera el saldo.",
  );
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
    new Response("Servicio no disponible", { status: 503 }),
  ));
  await expect(api("/clients")).rejects.toThrow("No se pudo completar la operación.");
});
