import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { expect, test } from "vitest";

const sourceRoot = resolve("src");
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(file)
      : /\.tsx?$/.test(file) && !file.endsWith(".test.ts") ? [file] : [];
  });
}
const sources = new Map(sourceFiles(sourceRoot).map((file) => [file, readFileSync(file, "utf8")]));
function imports(source: string) {
  return [...source.matchAll(/^import\s+(type\s+)?[\s\S]*?from\s+["']([^"']+)["'];/gm)]
    .map((match) => ({ typeOnly: Boolean(match[1]), target: match[2] }));
}

test("shared modules stay independent of features and app composition", () => {
  const shared = join(sourceRoot, "shared");
  for (const [file, source] of sources) {
    if (!file.startsWith(shared)) continue;
    for (const dependency of imports(source)) {
      if (!dependency.target.startsWith(".")) continue;
      expect(resolve(dirname(file), dependency.target).startsWith(shared), file).toBe(true);
    }
  }
});

test("HTTP transport stays in shared; views and coordination use feature APIs", () => {
  const transport = join(sourceRoot, "shared", "api", "http.ts");
  for (const [file, source] of sources) {
    if (file !== transport) expect(source, file).not.toMatch(/\bfetch\s*\(/);
    if (!/[\\/](?:components|hooks)[\\/]/.test(file) && !file.endsWith(`${join("app", "useBackofficeData.ts")}`)) continue;
    expect(imports(source).some((dependency) => dependency.target.includes("shared/api/http")), file).toBe(false);
  }
});

test("runtime imports have no local dependency cycles", () => {
  const visited = new Set<string>();
  const visiting: string[] = [];
  function visit(file: string) {
    expect(visiting, `Import cycle involving ${file}`).not.toContain(file);
    if (visited.has(file)) return;
    visiting.push(file);
    for (const dependency of imports(sources.get(file)!)) {
      if (dependency.typeOnly || !dependency.target.startsWith(".")) continue;
      const target = resolve(dirname(file), dependency.target);
      const local = [target + ".ts", target + ".tsx"].find((candidate) => sources.has(candidate));
      if (local) visit(local);
    }
    visiting.pop();
    visited.add(file);
  }
  sources.forEach((_, file) => visit(file));
});
