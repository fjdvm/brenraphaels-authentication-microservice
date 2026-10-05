import nodemailer, { type Transporter } from "nodemailer";

import type { CredentialsMailer } from "@/lib/admin/user-provisioning";

type CredentialsMessage = Parameters<CredentialsMailer["sendCredentials"]>[0];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The message a new User receives: their Username, Temporary password and where to sign in. */
export function buildCredentialsEmail(message: CredentialsMessage, loginUrl: string) {
  const { firstName, username, temporaryPassword } = message;

  const text = [
    `Hello ${firstName},`,
    "",
    "An account has been created for you on the Bren Raphael's portal.",
    "",
    `Username: ${username}`,
    `Temporary password: ${temporaryPassword}`,
    "",
    `Sign in at ${loginUrl} with your Username (not your email address).`,
    "You will be asked to choose a new password straight after you sign in. The temporary password stops working once you have.",
  ].join("\n");

  const html = `<p>Hello ${escapeHtml(firstName)},</p>
<p>An account has been created for you on the Bren Raphael's portal.</p>
<p>Username: <strong>${escapeHtml(username)}</strong><br>
Temporary password: <strong>${escapeHtml(temporaryPassword)}</strong></p>
<p><a href="${escapeHtml(loginUrl)}">Sign in</a> with your Username (not your email address).
You will be asked to choose a new password straight after you sign in. The temporary password stops working once you have.</p>`;

  return { subject: "Your Bren Raphael's portal sign-in details", text, html };
}

export function createCredentialsMailer(options: {
  transport: Pick<Transporter, "sendMail">;
  from: string;
  loginUrl: string;
}): CredentialsMailer {
  return {
    async sendCredentials(message) {
      await options.transport.sendMail({
        from: options.from,
        to: message.to,
        ...buildCredentialsEmail(message, options.loginUrl),
      });
    },
  };
}

/** SMTP-backed mailer. Throws when the email configuration is incomplete, so the caller never claims delivery. */
export function createSmtpCredentialsMailer(): CredentialsMailer {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM, NEXT_PUBLIC_APP_URL } =
    process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !EMAIL_FROM || !NEXT_PUBLIC_APP_URL) {
    return {
      async sendCredentials() {
        throw new Error("Email is not configured (SMTP_HOST, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM).");
      },
    };
  }

  const port = Number(SMTP_PORT ?? 587);

  return createCredentialsMailer({
    transport: nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    }),
    from: EMAIL_FROM,
    loginUrl: new URL("/login", NEXT_PUBLIC_APP_URL).toString(),
  });
}
