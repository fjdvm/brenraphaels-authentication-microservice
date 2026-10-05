import nodemailer from "nodemailer";
import { describe, expect, it } from "vitest";

import { createCredentialsMailer } from "./credentials-mailer";

describe("credentials mailer", () => {
  it("delivers the Username and Temporary password to the User's Email", async () => {
    const transport = nodemailer.createTransport({ jsonTransport: true });
    const mailer = createCredentialsMailer({
      transport,
      from: "Bren Raphael's <no-reply@example.com>",
      loginUrl: "https://portal.example.com/login",
    });

    const sent: unknown[] = [];
    const original = transport.sendMail.bind(transport);
    transport.sendMail = (async (mail: Parameters<typeof original>[0]) => {
      const info = await original(mail);
      sent.push(JSON.parse((info as { message: string }).message));
      return info;
    }) as typeof transport.sendMail;

    await mailer.sendCredentials({
      to: "juan@example.com",
      firstName: "Juan <b>",
      username: "2026-JD-002",
      temporaryPassword: "Ab3!xyz&Qk7#mnPz",
    });

    expect(sent).toHaveLength(1);
    const message = sent[0] as { to: { address: string }[]; from: { address: string }; text: string; html: string };
    expect(message.to[0].address).toBe("juan@example.com");
    expect(message.from.address).toBe("no-reply@example.com");
    expect(message.text).toContain("Username: 2026-JD-002");
    expect(message.text).toContain("Temporary password: Ab3!xyz&Qk7#mnPz");
    expect(message.text).toContain("https://portal.example.com/login");
    expect(message.text).toContain("choose a new password");
    expect(message.html).toContain("Ab3!xyz&amp;Qk7#mnPz");
    expect(message.html).toContain("Juan &lt;b&gt;");
  });

  it("surfaces transport failures instead of swallowing them", async () => {
    const mailer = createCredentialsMailer({
      transport: { sendMail: () => Promise.reject(new Error("connection refused")) },
      from: "x@example.com",
      loginUrl: "https://portal.example.com/login",
    });

    await expect(
      mailer.sendCredentials({ to: "a@b.co", firstName: "A", username: "u", temporaryPassword: "p" }),
    ).rejects.toThrow("connection refused");
  });
});
