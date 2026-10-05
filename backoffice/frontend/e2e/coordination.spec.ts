import { test, expect, type Page } from "@playwright/test";

async function mockBackoffice(page: Page) {
  const requests: { path: string; method: string; body?: Record<string, unknown> }[] = [];
  const client = { id: 1, version: 1, data: { name: "Cliente de caracterización" } };
  const inquiry = {
    id: 7, number: 7, version: 1, client_id: 1, service: "EQUIPMENT",
    status: "INQUIRY", data: { title: "Consulta existente" },
    created_at: "2026-10-04T12:00:00Z", accepted_revision_id: null,
  };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    // Vite serves source modules such as /src/shared/api/http.ts during development.
    // Intercept only backend requests; source files must keep their JavaScript MIME type.
    if (!url.pathname.startsWith("/api/")) {
      await route.continue();
      return;
    }
    const body = request.method() === "POST" ? request.postDataJSON() : undefined;
    requests.push({ path: url.pathname + url.search, method: request.method(), body });
    const data =
      url.pathname === "/api/clients" ? [client] :
      url.pathname === "/api/catalog" ? [] :
      url.pathname === "/api/dashboard" ? {
        counts: [{ status: "INQUIRY", count: 1 }], pendingCases: 7,
        balances: { balance: "0", pending: 0 }, recent: [],
      } :
      url.pathname === "/api/cases" ? [inquiry] :
      url.pathname === "/api/audit" ? [] :
      url.pathname === "/api/cases/7" ? {
        case: inquiry, client, revisions: [], work: null,
        balance: { total: "0", paid: "0", balance: "0", status: "UNPAID" },
        payments: [], attachments: [], events: [],
      } :
      url.pathname === "/api/quotes/calculate" ? {
        subtotal: "1200.10", discount: "200.00", adjustment: "234.46", total: "1234.56",
      } :
      url.pathname === "/api/cases/7/revisions" ? { id: 11 } : undefined;
    await route.fulfill({
      status: data === undefined ? 500 : 200,
      contentType: "application/json",
      body: JSON.stringify(data ?? { message: "Ruta inesperada en caracterización" }),
    });
  });
  return requests;
}

test("navigation keeps server pending metric, client debounce and case filters", async ({ page }) => {
  const requests = await mockBackoffice(page);
  await page.goto("/");
  const pending = page.getByRole("button", { name: /Trabajos pendientes/ });
  await expect(pending.locator("strong")).toHaveText("7");
  await page.getByRole("button", { name: "Clientes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cliente de caracterización" })).toBeVisible();
  await page.getByLabel("Buscar nombre o teléfono").fill("Ana & Luis");
  await expect.poll(() => requests.some((r) => r.path === "/api/clients?q=Ana%20%26%20Luis")).toBe(true);
  await page.getByRole("button", { name: "Consultas y trabajos", exact: true }).click();
  await expect(page.getByText("Consulta existente", { exact: true })).toBeVisible();
  await page.getByLabel("Estado", { exact: true }).selectOption("DIAGNOSIS");
  await expect.poll(() => requests.some((r) => r.path === "/api/cases?status=DIAGNOSIS")).toBe(true);
  await page.getByRole("button", { name: "Limpiar filtros" }).click();
  await expect(page.getByLabel("Estado", { exact: true })).toHaveValue("");
});

test("quote edits invalidate displayed calculation and save decimal inputs through API", async ({ page }) => {
  const requests = await mockBackoffice(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Consultas y trabajos", exact: true }).click();
  await page.getByText("Consulta existente", { exact: true }).click();
  await page.getByRole("button", { name: "+ Presupuesto", exact: true }).click();
  await page.getByLabel("Descripción *", { exact: true }).fill("Concepto existente");
  await page.getByLabel("Cantidad *", { exact: true }).fill("1.100");
  await page.getByLabel("Precio unitario ARS *").fill("1200.10");
  await page.getByLabel("Plazo de realización *").fill("3 días");
  await page.getByRole("button", { name: "Calcular importes" }).click();
  await expect(page.locator(".totals")).toContainText("1.234,56");
  await page.getByLabel("Cantidad *", { exact: true }).fill("2.200");
  await expect(page.locator(".totals")).toHaveCount(0);
  await page.getByRole("button", { name: "Crear revisión" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const saved = requests.find((r) => r.path === "/api/cases/7/revisions" && r.method === "POST")?.body;
  expect(saved?.items).toEqual([{
    kind: "LABOR", description: "Concepto existente", quantity: "2.200",
    unit: "servicio", unitPrice: "1200.10", discountType: "NONE", discountValue: "0",
  }]);
  expect(saved).not.toHaveProperty("total");
  expect(saved).not.toHaveProperty("client");
});

test("a delayed calculation cannot restore totals for a draft edited in the meantime", async ({ page }) => {
  await mockBackoffice(page);
  let release: () => void = () => {};
  let calculating = false;
  const delayed = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/quotes/calculate", async (route) => {
    calculating = true;
    await delayed;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({
      subtotal: "1200.10", discount: "0", adjustment: "0", total: "1200.10",
    }) });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Consultas y trabajos", exact: true }).click();
  await page.getByText("Consulta existente", { exact: true }).click();
  await page.getByRole("button", { name: "+ Presupuesto", exact: true }).click();
  await page.getByLabel("Descripción *", { exact: true }).fill("Concepto existente");
  await page.getByLabel("Precio unitario ARS *").fill("1200.10");
  await page.getByRole("button", { name: "Calcular importes" }).click();
  await expect.poll(() => calculating).toBe(true);
  await page.getByLabel("Precio unitario ARS *").fill("2500.00");
  const response = page.waitForResponse("**/api/quotes/calculate");
  release();
  await (await response).finished();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await expect(page.locator(".totals")).toHaveCount(0);
  await expect(page.getByLabel("Precio unitario ARS *")).toHaveValue("2500.00");
});
