import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "../i18n.js";
import LoginPage from "./LoginPage.jsx";

const login = vi.fn();
const loginWithGoogle = vi.fn();

vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => ({ login, loginWithGoogle }),
}));

vi.mock("@react-oauth/google", () => ({
  GoogleLogin: () => <button type="button">Sign in with Google</button>,
}));

const renderLogin = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </I18nextProvider>
  );

describe("LoginPage account type selection", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    login.mockResolvedValue({ role: "candidate" });
    await i18n.changeLanguage("en");
  });

  it("defaults to Candidate and uses candidate registration", () => {
    renderLogin();

    expect(screen.getByRole("button", { name: "Candidate" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("link", { name: "Create Account" })).toHaveAttribute(
      "href",
      "/register"
    );
  });

  it("switches the registration destination for Employer", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { name: "Employer" }));

    expect(screen.getByRole("button", { name: "Employer" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("link", { name: "Create Account" })).toHaveAttribute(
      "href",
      "/register-company"
    );
  });

  it("submits the selected account type", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { name: "Employer" }));
    await user.type(screen.getByLabelText("Email"), "owner@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    fireEvent.submit(screen.getByRole("button", { name: "Sign In" }).closest("form"));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({
        email: "owner@example.com",
        password: "secret123",
        rememberMe: true,
        role: "employer",
      })
    );
  });
});
