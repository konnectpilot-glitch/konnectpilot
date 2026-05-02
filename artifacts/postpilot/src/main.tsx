import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";
import { installImpersonationHeader } from "./lib/impersonation";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

setBaseUrl(basePath);
installImpersonationHeader();

createRoot(document.getElementById("root")!).render(<App />);
