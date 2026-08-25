import { setFetchImplementation } from "@/lib/api/transport";
import { handleDemoRequest } from "./router";

let restoreTransport: (() => void) | null = null;

export function installDemoTransport(): void {
  restoreTransport?.();
  restoreTransport = setFetchImplementation((input, init) => {
    const request = new Request(input, init);
    return handleDemoRequest(request);
  });
}
