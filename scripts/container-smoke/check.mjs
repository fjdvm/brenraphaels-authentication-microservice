import assert from "node:assert/strict";

const origin = process.env.SMOKE_ORIGIN ?? "http://localhost:3000";
const request = (path, headers = {}) => fetch(`${origin}${path}`, {
  headers, redirect: "manual", signal: AbortSignal.timeout(30_000),
});

let healthy = false;
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    const response = await request("/api/health");
    if (response.status === 200) {
      assert.deepEqual(await response.json(), { status: "ok" });
      healthy = true;
      break;
    }
  } catch { /* The container may still be starting. */ }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
assert.ok(healthy, "anonymous health probe must return 200 and {status: ok}");

const anonymous = await request("/");
assert.ok([302, 303, 307, 308].includes(anonymous.status));
assert.equal(new URL(anonymous.headers.get("location"), origin).pathname, "/login");

const signedIn = await request("/", { Cookie: "__Secure-neon-auth.session_token=smoke-session" });
assert.equal(signedIn.status, 200, "signed-in home must render without a redirect");
const html = await signedIn.text();
assert.ok(html.includes("Smoke Staff"), "home must render the User read from PostgreSQL");
assert.ok(html.includes("SMOKE-142"), "home must render the database-backed Username");
assert.ok(html.includes("You don&#x27;t have access to any systems yet."));
assert.ok(!html.includes("NEXT_REDIRECT"), "streamed response must not redirect to login");
assert.ok(!html.includes('id="__next_error__"'), "streamed response must not contain an error page");

const asset = html.match(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/);
assert.ok(asset, "home must include static assets");
assert.equal((await request(asset[1])).status, 200, "standalone image must serve static assets");
assert.equal((await request("/logo.png")).status, 200, "standalone image must serve public files");
console.log("Container smoke passed: health, anonymous guard, signed-in database-backed home, assets.");
