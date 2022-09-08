// ==UserScript==
// @name         New React Userscript
// @version      0.1
// @description  New React Userscript
// @author       You
// @match        https://example.com/
// ==/UserScript==

import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { store } from "./app/store";
import { Provider } from "react-redux";
import "./index.css";
import App from "./App";


// Specify container here
const container = document.querySelector("body > div")!;
while (container.lastChild) {
  container.removeChild(container.lastChild);
}


const root = createRoot(container!);
root.render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>
);
