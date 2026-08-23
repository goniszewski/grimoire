import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { isDemoMode } from "./demo/enabled";

async function bootstrap(): Promise<void> {
  if (isDemoMode) {
    const { installDemoTransport } = await import("./demo/api/bootstrap");
    installDemoTransport();
  } else {
    await import("./normal-fonts.css");
  }

  createRoot(document.getElementById("root")!).render(<App />);
}

void bootstrap();
