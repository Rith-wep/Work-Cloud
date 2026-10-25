import React from "react";
import ReactDOM from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { BrowserRouter } from "react-router-dom";

import App from "./App.jsx";
import AppProviders from "./AppProviders.jsx";
import "./index.css";
import { redirectMainEntryIfNeeded } from "../shared/utils/hostRouting.js";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

if (!redirectMainEntryIfNeeded()) {
  const appTree = (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppProviders><App /></AppProviders>
    </BrowserRouter>
  );
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      {googleClientId ? <GoogleOAuthProvider clientId={googleClientId}>{appTree}</GoogleOAuthProvider> : appTree}
    </React.StrictMode>
  );
}
