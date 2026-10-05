import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// This suite writes to the API. Verify the disposable instance before each test,
// including PID/start time/JAR, database, storage, binding and HTTP readiness.
test.beforeEach(async ({ baseURL }) => {
  const database = process.env.SCALARIS_E2E_DATABASE;
  if (!database || !/^scalaris_test_[a-zA-Z0-9_]+$/.test(database)) {
    throw new Error("E2E requiere SCALARIS_E2E_DATABASE=scalaris_test_*; se rechaza la base real.");
  }
  if (!baseURL || !process.env.SCALARIS_E2E_URL) {
    throw new Error("E2E requiere SCALARIS_E2E_URL explícita para la instancia descartable.");
  }
  const windowsRoot = process.env.SystemRoot;
  if (!windowsRoot) throw new Error("E2E requiere Windows PowerShell 5.1 para verificar la instancia propia.");
  execFileSync(
    join(windowsRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
    ["-NoLogo", "-NoProfile", "-File", fileURLToPath(new URL("../../scripts/Assert-TestInstance.ps1", import.meta.url)),
      "-Database", database, "-Url", baseURL],
    { stdio: "pipe", timeout: 75_000 },
  );
});

const unique = () => Date.now().toString();
test("client to work, historical quote, partial payment and delivery with outstanding balance", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "El trabajo, en orden." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clientes", exact: true }).click();
  await page.getByRole("button", { name: "+ Nuevo cliente" }).click();
  const name = "Recorrido " + unique();
  await page.getByLabel("Nombre o identificación *").fill(name);
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await page
    .getByRole("button", { name: "Consultas y trabajos", exact: true })
    .click();
  await page.getByRole("button", { name: "+ Nueva consulta" }).click();
  await page
    .getByLabel("Cliente *", { exact: true })
    .selectOption({ label: name });
  await page.getByLabel("Título de consulta / trabajo *").fill("PC de prueba");
  await page
    .getByLabel("Falla declarada / repuesto solicitado")
    .fill("No enciende");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "PC de prueba" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cambiar estado / reabrir" }).click();
  await page.getByLabel("Nuevo estado").selectOption("DIAGNOSIS");
  await page.getByLabel("Motivo *", { exact: true }).fill("Revisión inicial");
  await page.getByRole("button", { name: "Confirmar cambio" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "+ Presupuesto", exact: true })
    .click();
  await page
    .getByLabel("Descripción *", { exact: true })
    .fill("Mano de obra acordada");
  await page.getByLabel("Precio unitario ARS *").fill("15000");
  await page.getByLabel("Plazo de realización *").fill("3 días");
  await page.getByRole("button", { name: "Calcular importes" }).click();
  await expect(page.locator(".totals")).toContainText("15.000");
  await page.getByRole("button", { name: "Crear revisión" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Registrar envío", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar registro de envío" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Registrar aceptación", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar aceptación de R1" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Registrar pago", exact: true })
    .click();
  await page.getByLabel("Importe ARS *", { exact: true }).fill("1500");
  await page.getByLabel("Referencia (distingue pagos iguales)").fill(unique());
  await page.getByRole("button", { name: "Confirmar pago" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Hay saldo pendiente.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Editar tareas / recepción / entrega" })
    .click();
  await page.getByRole("button", { name: "+ Tarea" }).click();
  await page.getByLabel("Tarea 1", { exact: true }).fill("Revisión y limpieza");
  await page.getByLabel("Horas reales (no modifican importe)").fill("2.5");
  await page
    .getByLabel("Entrega / constancia manual")
    .fill("Entregado presencialmente");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (const status of ["WORKING", "READY", "DELIVERED"]) {
    await page
      .getByRole("button", { name: "Cambiar estado / reabrir" })
      .click();
    await page.getByLabel("Nuevo estado").selectOption(status);
    await page
      .getByLabel("Motivo *", { exact: true })
      .fill("Registro manual de " + status);
    await page.getByRole("button", { name: "Confirmar cambio" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await expect(page.locator(".page-title .badge")).toHaveText("Entregado");
  await page.screenshot({
    path: test.info().outputPath("backoffice-desktop.png"),
    fullPage: true,
  });
  await page
    .getByLabel("Adjunto", { exact: true })
    .setInputFiles({
      name: "nota.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Adjunto de validación"),
    });
  await page.getByRole("button", { name: "Subir adjunto" }).click();
  await expect(
    page.getByRole("link", { name: "nota.txt", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: test.info().outputPath("backoffice-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("public guided form review download and manual import with duplicate detection", async ({
  page,
  request,
}) => {
  await page.goto("http://127.0.0.1:8082/consulta/index.html");
  await page
    .getByRole("button", { name: "Web / software", exact: true })
    .click();
  await page
    .getByLabel("¿Qué necesitás resolver? *")
    .fill("Sitio para actividad " + unique());
  await page
    .getByLabel("Nombre o identificación útil *")
    .fill("Consulta pública");
  await page.getByRole("button", { name: "Revisar consulta" }).click();
  await expect(
    page.getByRole("heading", { name: "Revisá antes de compartir" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "← Corregir respuestas" }).click();
  await expect(page.getByLabel("¿Qué necesitás resolver? *")).toHaveValue(
    /Sitio para/,
  );
  await page.getByRole("button", { name: "Revisar consulta" }).click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar ficha JSON" }).click();
  const download = await downloadEvent;
  const path = await download.path();
  expect(path).not.toBeNull();
  await page.screenshot({
    path: test.info().outputPath("public-form-desktop.png"),
    fullPage: true,
  });
  const href = await page
    .getByRole("link", { name: "Abrir WhatsApp con este mensaje" })
    .getAttribute("href");
  expect(href).toContain("https://wa.me/5492291402230?text=");
  expect(decodeURIComponent(href!)).not.toContain("Consulta pública");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: test.info().outputPath("public-form-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Importar ficha", exact: true })
    .click();
  await page.getByLabel("Ficha JSON v1 (hasta 32 KB)").setInputFiles(path!);
  await expect(
    page.getByRole("heading", { name: "Vista previa · Web / software" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirmar importación" }).click();
  await expect(
    page.getByRole("heading", { name: /Sitio para actividad/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Importar ficha", exact: true })
    .click();
  await page.getByLabel("Ficha JSON v1 (hasta 32 KB)").setInputFiles(path!);
  await expect(page.getByText(/Ya importada en consulta/)).toBeVisible();
});
