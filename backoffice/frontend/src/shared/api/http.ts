export async function api<T>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch("/api" + url, {
    method,
    headers: {
      "X-Scalaris-Request": "1",
      ...(body instanceof FormData
        ? {}
        : body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  if (!response.ok) {
    let message = "No se pudo completar la operación.";
    try {
      message = (await response.json()).message || message;
    } catch { }
    throw new Error(message);
  }
  return response.json();
}
