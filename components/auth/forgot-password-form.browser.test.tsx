// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const forgotPasswordAction = vi.hoisted(() => vi.fn());
vi.mock("@/actions/auth", () => ({ forgotPasswordAction }));

import { ForgotPasswordForm } from "./forgot-password-form";

afterEach(() => {
  cleanup();
  forgotPasswordAction.mockReset();
});

async function requestLink(email: string) {
  const user = userEvent.setup();
  render(<ForgotPasswordForm />);
  await user.type(screen.getByLabelText("Email"), email);
  await user.click(screen.getByRole("button", { name: /send reset link/i }));
}

describe("ForgotPasswordForm", () => {
  it("shows Check your email for the address the User entered once the request is accepted", async () => {
    forgotPasswordAction.mockResolvedValue({ error: null, message: "sent" });
    await requestLink("someone@company.com");

    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeTruthy();
    expect(screen.getByText(/If someone@company\.com belongs to a user, a reset link is on its way/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /back to log in/i }).getAttribute("href")).toBe("/login");
    expect(screen.queryByLabelText("Email")).toBeNull();
  });

  it("keeps the form and shows the error when the request is refused", async () => {
    forgotPasswordAction.mockResolvedValue({ error: "Enter a valid email." });
    await requestLink("someone@company.com");

    expect((await screen.findByRole("alert")).textContent).toBe("Enter a valid email.");
    expect(screen.getByRole("heading", { name: "Forgot your password?" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Check your email" })).toBeNull();
  });

  it("shows a spinner and does not claim the link was sent until the server answers", async () => {
    let settle: (state: { error: string | null; message?: string }) => void = () => {};
    forgotPasswordAction.mockReturnValue(new Promise((resolve) => (settle = resolve)));

    await requestLink("someone@company.com");

    expect((await screen.findByRole("button", { name: /sending/i })).hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("heading", { name: "Check your email" })).toBeNull();

    await act(async () => settle({ error: null, message: "sent" }));
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeTruthy();
  });
});
