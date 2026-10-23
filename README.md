This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Connecting a System (step by step)

How a business System (CRMS/CREOMS, HRMS, POS, IMS) plugs into the portal, from nothing to a **deployed** System that signs in through the portal. CRMS (CREOMS) is the model: deployed at `https://epic-crms.vercel.app`, callback `https://epic-crms.vercel.app/api/portal/callback`. Do the steps in order.

The idea: the portal owns the login and each User's Module access. Your System never sees a password and keeps no authoritative session. It trades a one-time code for an opaque **handle**, then asks the portal **before every protected request** whether that handle may use that Module right now.

Wire-level details are in [`docs/integrations/system-handoff.md`](docs/integrations/system-handoff.md). The code to copy is [`reference/system-consumer/consumer.ts`](reference/system-consumer/consumer.ts).

### Part A: Prepare the portal side

**Step 1. Confirm the System and its Modules exist.**
Systems and Modules are seeded in [`lib/seed-data.ts`](lib/seed-data.ts). The System `name` (e.g. `CRMS`) and every Module name (e.g. `Customer Profiles`) must match exactly what your System sends later. Add or rename them there and re-seed. Access is granted per Module in the portal's User Management.

**Step 2. Decide your callback route.**
Pick one fixed route on your System, as CREOMS does with `/api/portal/callback`. You will have one callback per environment:

| Environment | Callback |
| --- | --- |
| Local | `http://localhost:3000/api/portal/callback` |
| Deployed | `https://<your-system-domain>/api/portal/callback` |

Callbacks must be absolute and matched exactly. `https` is required except for `localhost`.

### Part B: Build the integration in your System

**Step 3. Copy the consumer.**
Copy `reference/system-consumer/consumer.ts` into your System (it needs only `fetch` and `node:crypto`).

**Step 4. Add server-side environment variables.**
Names are up to you. Leave values empty for now; you fill them in at steps 7 and 11.

```env
PORTAL_URL=            # portal origin, no trailing slash
PORTAL_SYSTEM_NAME=    # exactly the registered name, e.g. CRMS
PORTAL_BACKEND_SECRET= # iss_... printed once at registration. Server-side only: never NEXT_PUBLIC_, never committed
APP_URL=               # this System's own origin, used to build the callback
```

**Step 5. Create the consumer once.**

```ts
const portal = createSystemConsumer({
  portalUrl: process.env.PORTAL_URL!,
  systemName: process.env.PORTAL_SYSTEM_NAME!,
  backendSecret: process.env.PORTAL_BACKEND_SECRET!,
  callbackUrl: `${process.env.APP_URL}/api/portal/callback`, // exactly as registered
});
```

The reference keeps pending sign-ins and handles in memory. On Vercel or any multi-instance deployment, store them in your own database or Redis instead, or the callback may land on a different instance than the one that started sign-in.

**Step 6. Wire up sign-in, callback, per-request check and sign-out.**

1. *Start sign-in.* Wherever there is no session (middleware, a "Sign in" button), redirect to the URL from `startSignIn()`. This one redirect covers both a User opening your System directly (the portal shows login, then sends them back) and a User clicking the System's card in the portal.
   ```ts
   const { authorizeUrl } = portal.startSignIn();
   return redirect(authorizeUrl);
   ```
2. *Callback route* (e.g. `app/api/portal/callback/route.ts`):
   ```ts
   const result = await portal.completeSignIn(request.url);
   if (result.ok) {
     // Set your own cookie to result.sessionId (HttpOnly, Secure, SameSite=Lax), then go to the app.
   }
   // Otherwise start over from "Start sign-in". The code is single-use; never retry the same callback.
   ```
   The browser only ever holds your opaque `sessionId`. The portal handle stays on your server.
3. *Before every protected page or API route*, pass the Module being requested:
   ```ts
   const decision = await portal.authenticate(sessionId, "Customer Profiles");
   if (!decision.allow) { /* handle decision.reason, see the table below */ }
   ```
   Serve only on an explicit allow. Do not cache the decision between requests; that is what makes logout, revocation and deletion take effect on the next request.
4. *Sign-out button:* forget your local session id, then answer with a `303` redirect to `<PORTAL_URL>/logout`.

| Reason | Meaning | Do |
| --- | --- | --- |
| `sign_in_required` | Logged out, expired, revoked, or no session. | Restart sign-in. |
| `no_access` | User is Deleted, awaiting a password change, or has no active grant on this Module. | Show a no-access page. Logging in again will not help. |
| `unavailable` | The portal could not decide. | **Deny**, show "temporarily unavailable", retry later. Never allow on an outage. |
| `misconfigured` | Wrong secret, System name or request. | Deny and alert an operator. |

### Part C: Test locally before deploying

**Step 7. Register the local callback and run both apps.** Use a dev or disposable database: registering replaces the System's callbacks and rotates its secret.

```bash
npm run system:register -- CRMS http://localhost:3000/api/portal/callback   # in this repo; prints the secret once
```

Put the printed secret in your System's `.env.local` as `PORTAL_BACKEND_SECRET`, set `PORTAL_URL` to the portal's address and `APP_URL` to your System's local address, then start the portal and your System on different ports.

**Step 8. Walk through it in a browser.**

1. Open a protected page of your System while signed out. You should land on the portal login, then return to your System, signed in.
2. Open your System from its card in the portal. You should land straight in without logging in again.
3. Log out of the portal and refresh your System. It should deny.
4. Revoke the Module for the User in User Management and refresh. It should show no-access.
5. Stop the portal and refresh. It should show "temporarily unavailable", not the page.

No System of your own yet? `SIM_BACKEND_SECRET=iss_… npm run system:simulate` runs a simulated one on `:4000` (register `http://localhost:4000/auth/callback` first), and `http://localhost:4000/modules/Dashboard` shows the same flow.

### Part D: Deploy your System and connect it to the portal

**Step 9. Deploy your System.**
Deploy it (e.g. on Vercel) so it has a stable production URL, such as `https://epic-crms.vercel.app`. Use a fixed production domain, not a per-deployment preview URL, because the callback is matched exactly.

**Step 10. Register the deployed callback with the portal.**
Registering replaces the whole callback list, so include every callback you still need (deployed and local) in the one command:

```bash
npm run system:register -- CRMS https://<your-system-domain>/api/portal/callback http://localhost:3000/api/portal/callback
```

Copy the new `iss_…` secret from the output. It is shown once, and the previous secret stops working immediately.

**Step 11. Set the production environment variables and redeploy.**
In your hosting dashboard (Vercel: Project, Settings, Environment Variables, Production) set the four variables from step 4:

| Variable | Production value |
| --- | --- |
| `PORTAL_URL` | The deployed portal origin |
| `PORTAL_SYSTEM_NAME` | The registered name, e.g. `CRMS` |
| `PORTAL_BACKEND_SECRET` | The `iss_…` secret from step 10 |
| `APP_URL` | `https://<your-system-domain>` |

Redeploy so the new values take effect.

**Step 12. Point the portal card at the deployed System.**
The portal opens the System's `url` from [`lib/seed-data.ts`](lib/seed-data.ts) when a User clicks its card. Set it to your deployed origin (CRMS: `https://epic-crms.vercel.app`), add the deployed callback to `callbackUrls`, and re-seed or deploy the portal. Seeded URLs are never trusted as callbacks by themselves; step 10 is what makes a callback trusted.

**Step 13. Verify the deployed System.** Repeat the five checks from step 8 against the deployed URLs: direct entry, launch from the portal card, central logout, Module revocation, portal outage.

### Never do this

- Treat a visible portal card, a cookie, a token, or an earlier allow as proof of access.
- Accept a callback or redirect target that is not on the registered list.
- Log or expose the code, verifier, handle or backend secret.
- Allow because the portal is slow or down.

Full walkthrough: [`docs/integrations/system-integration-guide.md`](docs/integrations/system-integration-guide.md). What is verified and what is outstanding: [`docs/integrations/verification.md`](docs/integrations/verification.md). Note that no real System is integrated yet.
