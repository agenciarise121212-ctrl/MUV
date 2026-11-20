// Fetch seguro: nunca chama res.json() em HTML/texto (evita "The string did not match the expected pattern." no Safari)
export type JsonResult<T> = { ok: true; data: T; status: number } | { ok: false; error: string; status: number; data?: T };

export async function fetchJson<T = Record<string, unknown>>(url: string, init?: RequestInit & { json?: unknown }): Promise<JsonResult<T>> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(url, json !== undefined ? { ...rest, method: rest.method ?? "POST", headers: { "Content-Type": "application/json", ...(rest.headers ?? {}) }, body: JSON.stringify(json) } : rest);
  } catch {
    return { ok: false, status: 0, error: "Sem conexão. Verifique sua internet e tente novamente." };
  }
  const type = res.headers.get("content-type") ?? "";
  let data: T | undefined;
  if (type.includes("application/json")) { try { data = (await res.json()) as T; } catch { data = undefined; } }
  else { try { await res.text(); } catch {} }
  if (res.ok && data !== undefined) return { ok: true, data, status: res.status };
  const err = (data as { error?: string } | undefined)?.error;
  return { ok: false, status: res.status, data, error: err || (res.status >= 500 ? "O servidor teve um problema. Tente novamente em instantes." : res.ok ? "Resposta inesperada do servidor." : `Falha na requisição (${res.status}).`) };
}
