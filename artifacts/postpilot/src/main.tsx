import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";
import { installImpersonationHeader } from "./lib/impersonation";
import { captureReferralFromUrl } from "./lib/affiliate-tracking";
import { initTheme } from "./lib/theme";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

setBaseUrl(basePath);
installImpersonationHeader();
void captureReferralFromUrl(basePath);
// Apply persisted theme before first paint so we don't flash light → dark.
initTheme();

createRoot(document.getElementById("root")!).render(<App />);
