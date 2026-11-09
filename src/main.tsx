import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyAppearance, loadStoredAppearance } from "./theme";
import { isMobileHost } from "./platform";

if (isMobileHost()) {
  document.documentElement.classList.add("mobile-host");
}

applyAppearance(loadStoredAppearance());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
