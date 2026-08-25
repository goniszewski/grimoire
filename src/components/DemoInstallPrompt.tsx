import { ExternalLink, HardDrive } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DEMO_INSTALL_URL } from "@/demo/enabled";

interface DemoInstallPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: string;
}

export function DemoInstallPrompt({ open, onOpenChange, action }: DemoInstallPromptProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" aria-hidden="true" />
            {action} is local-only
          </DialogTitle>
          <DialogDescription>
            The public demo has no hosted library or server database. Install Grimoire to {action.toLowerCase()} in a private library on your machine.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Keep exploring</Button>
          <Button asChild className="gap-1.5">
            <a href={DEMO_INSTALL_URL} target="_blank" rel="noreferrer">
              Install Grimoire <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
