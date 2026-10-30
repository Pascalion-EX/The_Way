import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { AppContextProvider } from "./Context/AppContext.jsx";
import PageErrorBoundary from "./Components/PageErrorBoundary.jsx";
import { installChunkRecovery } from "./utils/chunkRecovery.js";

if (import.meta.env.PROD) installChunkRecovery(window, import.meta.url);

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <AppContextProvider>
      <PageErrorBoundary>
        <App />
      </PageErrorBoundary>
    </AppContextProvider>
  </BrowserRouter>,
);
