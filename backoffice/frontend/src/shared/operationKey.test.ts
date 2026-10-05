import { afterEach, expect, test, vi } from "vitest";
import { newOperationKey } from "./operationKey";

afterEach(() => vi.unstubAllGlobals());

test("payment operation key uses the browser UUID generator when available", () => {
  const randomUUID = vi.fn(() => "2fa20248-cfdc-43b9-a9ca-aa6d2b3d6a73");
  const getRandomValues = vi.fn();
  vi.stubGlobal("crypto", { randomUUID, getRandomValues });

  expect(newOperationKey()).toBe("2fa20248-cfdc-43b9-a9ca-aa6d2b3d6a73");
  expect(randomUUID).toHaveBeenCalledOnce();
  expect(getRandomValues).not.toHaveBeenCalled();
});

test("payment operation key remains a UUID v4 on LAN HTTP without randomUUID", () => {
  const getRandomValues = vi.fn((bytes: Uint8Array) => {
    bytes.fill(0xff);
    return bytes;
  });
  vi.stubGlobal("crypto", { getRandomValues });

  const key = newOperationKey();
  expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(key).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
  expect(getRandomValues).toHaveBeenCalledOnce();
  expect(getRandomValues.mock.calls[0][0]).toBeInstanceOf(Uint8Array);
  expect(getRandomValues.mock.calls[0][0]).toHaveLength(16);
});
