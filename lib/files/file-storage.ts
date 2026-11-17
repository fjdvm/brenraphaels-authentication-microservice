/** The file-storage boundary, reached through the api-gateway with the Portal's Caller key. Tests replace it with a fake. */
export type PrivateFiles = {
  /** Stores the bytes as an Active, Private, Permanent File and returns its id. */
  upload(file: { filename: string; contentType: string; bytes: Uint8Array }, link: { entityType: string; entityId: string; role: string }): Promise<string>;
  /** A fresh, short-lived signed address to show the File from. */
  viewUrl(fileId: string): Promise<string>;
  remove(fileId: string): Promise<void>;
};

type Gateway = { baseUrl?: string; callerKey?: string; fetch?: typeof fetch };

export function gatewayPrivateFiles({ baseUrl = process.env.API_GATEWAY_URL, callerKey = process.env.API_GATEWAY_KEY, fetch: send = fetch }: Gateway = {}): PrivateFiles {
  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!baseUrl || !callerKey) throw new Error("API_GATEWAY_URL and API_GATEWAY_KEY must be set.");
    const response = await send(`${baseUrl.replace(/\/$/, "")}/files${path}`, { ...init, headers: { Authorization: `Bearer ${callerKey}`, "Content-Type": "application/json" } });
    if (!response.ok) throw new Error(`file-storage refused ${init.method ?? "GET"} ${path}: ${response.status}`);
    return (response.status === 204 ? undefined : await response.json()) as T;
  }

  return {
    async upload({ filename, contentType, bytes }, link) {
      const pending = await call<{ id: string; uploadUrl: string }>("", {
        method: "POST",
        body: JSON.stringify({ filename, contentType, size: bytes.length, visibility: "private", retentionType: "permanent" }),
      });
      // The upload address is file-storage's own, so it takes no gateway key.
      const put = await send(pending.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: bytes as BodyInit });
      if (!put.ok) throw new Error(`The image upload was refused: ${put.status}`);
      await call(`/${pending.id}/confirm`, { method: "POST" });
      await call(`/${pending.id}/links`, { method: "POST", body: JSON.stringify({ system: "PORTAL", ...link }) });
      return pending.id;
    },
    async viewUrl(fileId) {
      return (await call<{ url: string }>(`/${fileId}`)).url;
    },
    async remove(fileId) {
      await call(`/${fileId}`, { method: "DELETE" });
    },
  };
}
