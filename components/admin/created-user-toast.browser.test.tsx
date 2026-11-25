// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";

import { CreatedUserToast } from "./created-user-toast";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CreatedUserToast", () => {
  it("confirms the new account in a success toast, once per Username", () => {
    render(<CreatedUserToast username="2026-JD-001" />);

    expect(toast.success).toHaveBeenCalledWith(
      "User 2026-JD-001 was created. Their Username and Temporary password have been emailed to them.",
      { id: "user-created-2026-JD-001" },
    );
  });
});
