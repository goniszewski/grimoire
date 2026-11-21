import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { isDemoMode } from "./demo/enabled";

async function bootstrap(): Promise<void> {
  if (isDemoMode) {
    document.body.dataset.demoMode = "true";
    const { installDemoTransport } = await import("./demo/api/bootstrap");
    installDemoTransport();
  } else {
    await import("./normal-fonts.css");
  }

  createRoot(document.getElementById("root")!).render(<App />);

  // Makes the app installable so Android lists it in the Share menu. The worker caches nothing.
  if (import.meta.env.PROD && !isDemoMode && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability is optional; the app works without a worker.
    });
  }
}

void bootstrap();
