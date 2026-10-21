// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const loginAction = vi.hoisted(() => vi.fn());
vi.mock("@/actions/auth", () => ({ loginAction }));

import { LoginForm } from "./login-form";

// A held sign-in must settle before the next test: React keeps an unsettled action
// entangled with every later transition.
let settleSignIn: (state: { error: string | null }) => void = () => {};

function holdSignIn() {
  loginAction.mockReturnValue(new Promise((resolve) => (settleSignIn = resolve)));
}

afterEach(async () => {
  await act(async () => settleSignIn({ error: null }));
  cleanup();
  loginAction.mockReset();
});

async function submitCredentials() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Username"), "2026-JD-001");
  await user.type(screen.getByLabelText("Password"), "a-password");
  await user.click(screen.getByRole("button", { name: /log in/i }));
}

describe("LoginForm signing-in card", () => {
  it("shows the Signing you in card while credentials are checked", async () => {
    holdSignIn();
    render(<LoginForm passwordWasReset={false} />);
    expect(screen.queryByRole("status", { name: /signing you in/i })).toBeNull();

    await submitCredentials();

    const card = await screen.findByRole("status", { name: /signing you in/i });
    expect(card.textContent).toContain("Checking your access to each system");
  });

  it("clears the card and shows the error when sign-in is refused", async () => {
    holdSignIn();
    render(<LoginForm passwordWasReset={false} />);
    await submitCredentials();
    await screen.findByRole("status", { name: /signing you in/i });

    await act(async () => settleSignIn({ error: "Invalid credentials" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Invalid credentials");
    await waitFor(() => expect(screen.queryByRole("status", { name: /signing you in/i })).toBeNull());
  });
});
