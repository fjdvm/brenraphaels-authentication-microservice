// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/auth", () => ({ loginAction: vi.fn() }));

import { AuthPage } from "./auth-card";
import { LoginForm } from "./login-form";

afterEach(cleanup);

function renderLoginScreen() {
  return render(
    <AuthPage>
      <LoginForm passwordWasReset={false} />
    </AuthPage>,
  );
}

describe("Log in screen (Figma Portal · Log in)", () => {
  it("shows the brand panel copy and the Enterprise Suite Lockup", () => {
    const { container } = renderLoginScreen();

    for (const text of [
      "Internal system · Staff only",
      "Everything the team needs to run the business.",
      "Sign in to open the tools for your role: customers and orders, people, inventory or branch sales.",
      "For Bren Raphael's team members only",
      "Your access is set by an admin",
      "Every sign-in is verified by email and logged",
      "Protected sign-in with email verification",
      "© 2026 Bren Raphael's · Internal use",
      "Trouble logging in? Contact your administrator.",
    ]) {
      expect(container.textContent).toContain(text);
    }
    // The panel's Lockup plus the one that tops the form on narrow screens.
    expect(screen.getAllByText("Bren Raphael's")).toHaveLength(2);
    expect(screen.getAllByText("Enterprise Suite")).toHaveLength(2);
    expect(container.querySelector('img[src*="logo-tile"]')).not.toBeNull();
  });

  it("shows the form fields, remember checkbox, forgot link and button", () => {
    renderLoginScreen();

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeTruthy();
    expect(screen.getByLabelText("Username")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show password" })).toBeTruthy();
    expect((screen.getByLabelText("Remember this device for 30 days") as HTMLInputElement).type).toBe("checkbox");
    expect(screen.getByRole("link", { name: "Forgot password?" }).getAttribute("href")).toBe("/forgot-password");
    expect(screen.getByRole("button", { name: /log in/i })).toBeTruthy();
  });
});
