// ==UserScript==
// @name         New Userscript
// @version      0.1
// @description  New React Userscript
// @author       You
// @match        https://example.com/
// ==/UserScript==

import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const root = createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
