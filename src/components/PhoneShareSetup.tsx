import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DAEMON_URL, downloadAppleShortcut } from "@/lib/api";

const DEFAULT_CATEGORY = "Safari inbox";
const SIGN_COMMAND =
  "shortcuts sign --mode anyone -i SendToGrimoire.shortcut -o SendToGrimoire-signed.shortcut";

function isLoopbackUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".localhost");
  } catch {
    return false;
  }
}

function saveBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}

function AppleShortcutPanel() {
  const qc = useQueryClient();
  const [serverUrl, setServerUrl] = useState(DAEMON_URL);
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [unsigned, setUnsigned] = useState(false);

  const generate = useMutation({
    mutationFn: () =>
      downloadAppleShortcut({
        server_url: serverUrl.trim(),
        ...(category.trim() ? { category: category.trim() } : {}),
      }),
    onSuccess: ({ blob, filename, signed }) => {
      saveBlob(blob, filename);
      setUnsigned(!signed);
      toast.success(signed ? "Shortcut downloaded" : "Unsigned shortcut downloaded");
      void qc.invalidateQueries({ queryKey: ["integration-tokens"] });
    },
    onError: (err: Error) => {
      toast.error("Could not generate the shortcut", { description: err.message });
    },
  });

  const loopback = isLoopbackUrl(serverUrl);

  return (
    <div className="space-y-3">
      <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
        <li>Enter the address your iPhone or Mac uses to reach Grimoire, then generate the shortcut.</li>
        <li>Open the downloaded file (AirDrop or iCloud Drive for iPhone) and choose Add Shortcut.</li>
        <li>
          In Safari, tap Share and choose SendToGrimoire. The first time, choose Always Allow when Shortcuts asks to
          send data to your Grimoire address. The page is saved and you can close the tab.
        </li>
      </ol>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="shortcut-server-url" className="text-xs">Grimoire address</Label>
          <Input
            id="shortcut-server-url"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="https://my-mac.tailnet.ts.net"
            className="text-xs h-8"
            inputMode="url"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="shortcut-category" className="text-xs">Save into category (optional)</Label>
          <Input
            id="shortcut-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="text-xs h-8"
          />
        </div>
      </div>

      {loopback && (
        <p className="text-xs text-warning">
          127.0.0.1 only works on this Mac. For an iPhone, use a Tailscale Serve address so the daemon stays on
          loopback — see Remote access in the docs.
        </p>
      )}

      <Button
        size="sm"
        onClick={() => generate.mutate()}
        disabled={generate.isPending || !serverUrl.trim()}
      >
        {generate.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
        ) : (
          <Download className="h-3.5 w-3.5 mr-1.5" />
        )}
        Generate SendToGrimoire.shortcut
      </Button>

      {unsigned && (
        <div className="rounded border border-warning/30 bg-warning/10 px-3 py-2 text-xs space-y-1">
          <p className="text-warning font-medium">This file is not signed, so Shortcuts will refuse it.</p>
          <p className="text-muted-foreground">
            Only macOS can sign shortcut files. Run this on any Mac, then open the signed copy:
          </p>
          <code className="block rounded bg-muted px-2 py-1 break-all select-all">{SIGN_COMMAND}</code>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Each generated file embeds its own new integration token (named “Apple Shortcut”). Treat the file like a
        password and revoke the token in the list below if you lose a device.
      </p>
    </div>
  );
}

function AndroidPanel() {
  return (
    <div className="space-y-3">
      <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
        <li>
          Open Grimoire in Chrome on your phone using an <strong>HTTPS</strong> address (for example Tailscale Serve).
          Android only offers installed web apps in the Share menu.
        </li>
        <li>Open the Chrome menu and choose Install app (Add to Home screen).</li>
        <li>In any browser, tap Share and choose Grimoire. The link is saved and you can close the tab.</li>
      </ol>
      <p className="text-[11px] text-muted-foreground">
        Shared links open Grimoire briefly to save, then show a confirmation. No token is stored on the phone; the
        installed app uses the same access as the web UI.
      </p>
    </div>
  );
}

export function PhoneShareSetup() {
  return (
    <section className="space-y-4" aria-labelledby="phone-share-heading">
      <div>
        <h2 id="phone-share-heading" className="text-sm font-semibold flex items-center gap-1.5">
          <Smartphone className="h-3.5 w-3.5" />
          Save from your phone
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Send the page you are reading to Grimoire from the Share menu, then close the tab.
        </p>
      </div>

      <Tabs defaultValue="apple">
        <TabsList>
          <TabsTrigger value="apple">iPhone &amp; Mac</TabsTrigger>
          <TabsTrigger value="android">Android</TabsTrigger>
        </TabsList>
        <TabsContent value="apple" className="pt-2">
          <AppleShortcutPanel />
        </TabsContent>
        <TabsContent value="android" className="pt-2">
          <AndroidPanel />
        </TabsContent>
      </Tabs>
    </section>
  );
}
