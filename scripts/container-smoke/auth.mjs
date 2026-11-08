// Test provider only: production uses Managed Neon Auth. Never copied into runtime.
import { createServer } from "node:http";

createServer((request, response) => {
  if (new URL(request.url, "http://auth").pathname !== "/get-session") {
    response.writeHead(503).end(); // Shared services are outside this smoke test.
    return;
  }
  response.setHeader("Content-Type", "application/json");
  if (!request.headers.cookie?.includes("__Secure-neon-auth.session_token=smoke-session")) {
    response.end("null");
    return;
  }
  const now = new Date().toISOString();
  response.end(JSON.stringify({
    session: {
      id: "smoke-session", token: "smoke-session", userId: "smoke-auth-user",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(), createdAt: now, updatedAt: now,
    },
    user: {
      id: "smoke-auth-user", name: "Smoke Staff", email: "smoke@example.test",
      emailVerified: true, createdAt: now, updatedAt: now,
    },
  }));
}).listen(8080, "0.0.0.0");
