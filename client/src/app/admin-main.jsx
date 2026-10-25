import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";

import AdminApp from "../features/admin/AdminApp.jsx";
import AppProviders from "./AppProviders.jsx";
import "./index.css";
import { isLocalHost, redirectAdminEntryIfNeeded } from "../shared/utils/hostRouting.js";

if (!redirectAdminEntryIfNeeded()) {
  const RouterComponent = isLocalHost() ? HashRouter : BrowserRouter;
  const appTree = (
    <RouterComponent future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppProviders><AdminApp /></AppProviders>
    </RouterComponent>
  );
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>{appTree}</React.StrictMode>
  );
}
