export type ApiEnvelope<T> = { data: T };
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      body?.error?.message ?? `Request failed (${response.status})`,
    );
  return (body as ApiEnvelope<T>).data;
}
