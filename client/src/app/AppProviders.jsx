import { I18nextProvider } from "react-i18next";
import { AuthProvider } from "../shared/context/AuthContext.jsx";
import { NotificationProvider } from "../shared/context/NotificationContext.jsx";
import i18n from "./i18n.js";

function AppProviders({ children }) {
  return <I18nextProvider i18n={i18n}><AuthProvider><NotificationProvider>{children}</NotificationProvider></AuthProvider></I18nextProvider>;
}
export default AppProviders;
