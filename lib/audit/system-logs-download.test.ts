// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadSystemLogsCsv, EXPORT_PATH } from "./system-logs-download";

const query = {
  from: "2026-10-15T00:00:00.000+08:00",
  to: "2026-10-21T23:59:59.999+08:00",
  source: "Authentication",
  cursor: "c2",
};

function stub(response: Response | Error) {
  const fetchStub = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fetchStub);
  const createObjectURL = vi.fn(() => "blob:export");
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = vi.fn();
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  return { fetchStub, createObjectURL, click };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("downloading the System logs CSV", () => {
  it("asks the Portal's server for the shown filters and saves the file it names", async () => {
    const { fetchStub, click } = stub(
      new Response("id\r\n", {
        headers: { "Content-Disposition": 'attachment; filename="system-logs_2026-10-15_2026-10-21.csv"' },
      }),
    );

    await expect(downloadSystemLogsCsv(query)).resolves.toEqual({ status: "ok" });

    const requested = new URL(String((fetchStub.mock.calls[0] as unknown[])[0]), "https://portal.test");
    expect(requested.pathname).toBe(EXPORT_PATH);
    expect(Object.fromEntries(requested.searchParams)).toEqual({
      from: query.from,
      to: query.to,
      source: "Authentication",
    });
    expect(click).toHaveBeenCalledOnce();
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe("system-logs_2026-10-15_2026-10-21.csv");
  });

  it("downloads nothing over the cap", async () => {
    const { createObjectURL, click } = stub(Response.json({ error: "Too many" }, { status: 413 }));

    await expect(downloadSystemLogsCsv(query)).resolves.toEqual({ status: "too_large" });
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

  it.each([
    ["the server fails", new Response(null, { status: 502 })],
    ["the request cannot be sent", new Error("offline")],
  ])("reports an error and downloads nothing when %s", async (_label, response) => {
    const { click } = stub(response);

    await expect(downloadSystemLogsCsv(query)).resolves.toEqual({ status: "error" });
    expect(click).not.toHaveBeenCalled();
  });
});
