// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const forgotPasswordAction = vi.hoisted(() => vi.fn());
vi.mock("@/actions/auth", () => ({ forgotPasswordAction }));

import { AuthPage } from "./auth-card";
import { EmailVerifiedScreen } from "./email-verified-screen";
import { ForgotPasswordForm } from "./forgot-password-form";
import { VerifyByEmailScreen } from "./verify-by-email-screen";

afterEach(cleanup);

function expectBrandPanel(container: HTMLElement) {
  expect(container.textContent).toContain("Everything the team needs to run the business.");
  expect(screen.getAllByText("Enterprise Suite").length).toBeGreaterThan(0);
  expect(container.textContent).toContain("Trouble logging in? Contact your administrator.");
}

describe("Verify by email screen (Figma Portal · Verify by email)", () => {
  it("shows the Figma copy and its actions", async () => {
    const onResend = vi.fn();
    const { container } = render(
      <AuthPage>
        <VerifyByEmailScreen
          mailboxHref="https://mail.google.com"
          mailboxName="Gmail"
          maskedEmail="j•••••••08@gmail.com"
          onResend={onResend}
          resendIn="0:45"
        />
      </AuthPage>,
    );

    expectBrandPanel(container);
    expect(screen.getByRole("heading", { name: "Check your email" })).toBeTruthy();
    for (const text of [
      "We sent a sign-in link to j•••••••08@gmail.com. Click the link in that email to finish logging in.",
      "Waiting for you to click the link…",
      "This page continues by itself. The link expires in 15 minutes.",
      "Can't find it? Check your Spam or Promotions folder. You can resend in 0:45.",
    ]) {
      expect(container.textContent).toContain(text);
    }
    expect(screen.getByRole("link", { name: /open gmail/i }).getAttribute("href")).toBe("https://mail.google.com");
    expect(screen.getByRole("link", { name: "Use a different account" }).getAttribute("href")).toBe("/login");

    await userEvent.click(screen.getByRole("button", { name: "Resend link" }));
    expect(onResend).toHaveBeenCalledOnce();
  });
});

describe("Email verified screen (Figma Portal · Email verified)", () => {
  it("shows the Figma copy and continues to the portal", () => {
    const { container } = render(
      <AuthPage>
        <EmailVerifiedScreen account="Jude Nitram · 2026-ADMIN-001" device="Chrome on Windows" location="Antipolo, PH" />
      </AuthPage>,
    );

    expectBrandPanel(container);
    expect(screen.getByRole("heading", { name: "You're signed in" })).toBeTruthy();
    for (const text of [
      "Your email link was confirmed. Taking you to the portal…",
      "Account",
      "Jude Nitram · 2026-ADMIN-001",
      "Device",
      "Chrome on Windows",
      "Location",
      "Antipolo, PH",
      "Not you? Change your password and tell your administrator.",
    ]) {
      expect(container.textContent).toContain(text);
    }
    expect(screen.getByRole("link", { name: /continue to portal/i }).getAttribute("href")).toBe("/");
  });
});

describe("Forgot password screen (Figma Portal · Forgot password)", () => {
  it("shows the Figma copy, the Email field and Back to log in", () => {
    const { container } = render(
      <AuthPage>
        <ForgotPasswordForm />
      </AuthPage>,
    );

    expectBrandPanel(container);
    expect(screen.getByRole("heading", { name: "Forgot your password?" })).toBeTruthy();
    expect(container.textContent).toContain(
      "Enter the email your credentials were sent to and we'll email you a reset link.",
    );
    expect(screen.getByPlaceholderText("you@company.com")).toBeTruthy();
    expect(screen.getByRole("button", { name: /send reset link/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /back to log in/i }).getAttribute("href")).toBe("/login");
  });
});

describe("Reset link sent screen (Figma Portal · Reset link sent)", () => {
  it("shows the Figma copy and Back to log in after a request", async () => {
    forgotPasswordAction.mockResolvedValue({ error: null, message: "sent" });
    const user = userEvent.setup();
    const { container } = render(
      <AuthPage>
        <ForgotPasswordForm />
      </AuthPage>,
    );
    await user.type(screen.getByLabelText("Email"), "jude.nitram08@gmail.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeTruthy();
    expectBrandPanel(container);
    expect(container.textContent).toContain(
      "If jude.nitram08@gmail.com belongs to a user, a reset link is on its way.",
    );
    expect(screen.getByRole("link", { name: /back to log in/i }).getAttribute("href")).toBe("/login");
  });
});
