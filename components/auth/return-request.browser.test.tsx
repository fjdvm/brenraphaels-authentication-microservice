// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/auth", () => ({
  loginAction: vi.fn(),
  changePasswordAction: vi.fn(),
}));

import { ChangePasswordForm } from "./change-password-form";
import { LoginForm } from "./login-form";

const hiddenIntent = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>('input[type="hidden"][name="ri"]');

describe.each([
  ["login", (props: object) => <LoginForm passwordWasReset={false} {...props} />],
  ["change-password", (props: object) => <ChangePasswordForm {...props} />],
])("%s form with a System request", (_name, renderForm) => {
  afterEach(cleanup);

  it("carries a valid request in a hidden field and says where the User will continue", () => {
    const { container } = render(renderForm({ returnIntent: "signed.token", systemName: "CRMS" }));

    expect(hiddenIntent(container)?.value).toBe("signed.token");
    expect(screen.getByRole("status").textContent).toContain("continue to CRMS");
  });

  it("renders no System notice or hidden field for ordinary use", () => {
    const { container } = render(renderForm({}));

    expect(hiddenIntent(container)).toBeNull();
    expect(screen.queryByText(/continue to/i)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("explains an expired request with a way to restart, and carries nothing", () => {
    const { container } = render(renderForm({ requestProblem: "expired" }));

    expect(hiddenIntent(container)).toBeNull();
    expect(screen.getByRole("alert").textContent).toMatch(/expired.*start again/i);
  });

  it("explains an invalid request with a way to restart, and carries nothing", () => {
    const { container } = render(renderForm({ requestProblem: "invalid" }));

    expect(hiddenIntent(container)).toBeNull();
    expect(screen.getByRole("alert").textContent).toMatch(/isn't valid.*start again/i);
  });
});
