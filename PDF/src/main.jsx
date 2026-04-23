import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const base = import.meta.env.BASE_URL;
    const path = new URL("sw.js", new URL(base, self.location.origin)).toString();
    navigator.serviceWorker.register(path, { scope: base }).catch(() => undefined);
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
