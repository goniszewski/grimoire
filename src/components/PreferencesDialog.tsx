import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { LayoutGrid, List, Lock, ShieldCheck, ShieldOff } from "lucide-react";
import { ViewMode } from "@/hooks/use-preferences";
import { toast } from "sonner";

interface PreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showButtonLabels: boolean;
  viewMode: ViewMode;
  onUpdate: (prefs: { showButtonLabels?: boolean; viewMode?: ViewMode }) => void;
  // Lock props
  hasPassword: boolean;
  autoLockMinutes: number;
  onSetPassword: (password: string) => Promise<void>;
  onChangePassword: (current: string, next: string) => Promise<boolean>;
  onRemovePassword: (current: string) => Promise<boolean>;
  onSetAutoLockMinutes: (minutes: number) => void;
  onLockNow: () => void;
}

type SecurityMode = "idle" | "set" | "change" | "remove";

export function PreferencesDialog({
  open, onOpenChange, showButtonLabels, viewMode, onUpdate,
  hasPassword, autoLockMinutes, onSetPassword, onChangePassword, onRemovePassword, onSetAutoLockMinutes, onLockNow,
}: PreferencesDialogProps) {
  const [securityMode, setSecurityMode] = useState<SecurityMode>("idle");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");

  const resetSecurity = () => {
    setSecurityMode("idle");
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setError("");
  };

  const handleSetPassword = async () => {
    if (newPw.length < 4) { setError("Password must be at least 4 characters"); return; }
    if (newPw !== confirmPw) { setError("Passwords don't match"); return; }
    await onSetPassword(newPw);
    toast.success("App lock password set");
    resetSecurity();
  };

  const handleChangePassword = async () => {
    if (newPw.length < 4) { setError("Password must be at least 4 characters"); return; }
    if (newPw !== confirmPw) { setError("Passwords don't match"); return; }
    const ok = await onChangePassword(currentPw, newPw);
    if (!ok) { setError("Current password is incorrect"); return; }
    toast.success("Password changed");
    resetSecurity();
  };

  const handleRemovePassword = async () => {
    const ok = await onRemovePassword(currentPw);
    if (!ok) { setError("Password is incorrect"); return; }
    toast.success("App lock removed");
    resetSecurity();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetSecurity(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Preferences</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-2">
          {/* Button labels */}
          <div className="flex items-center justify-between">
            <Label htmlFor="btn-labels" className="text-sm">Show button labels</Label>
            <Switch
              id="btn-labels"
              checked={showButtonLabels}
              onCheckedChange={(checked) => onUpdate({ showButtonLabels: checked })}
            />
          </div>

          {/* View mode */}
          <div className="space-y-2">
            <Label className="text-sm">Bookmark view</Label>
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => { if (v) onUpdate({ viewMode: v as ViewMode }); }}
              className="justify-start"
            >
              <ToggleGroupItem value="grid" aria-label="Grid view" className="gap-1.5 text-xs">
                <LayoutGrid className="h-3.5 w-3.5" />
                Grid
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="List view" className="gap-1.5 text-xs">
                <List className="h-3.5 w-3.5" />
                List
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <Separator />

          {/* Security */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-sm font-medium">App Lock</Label>
            </div>

            {securityMode === "idle" && (
              <div className="space-y-3">
                {hasPassword ? (
                  <>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                      Password is set
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Auto-lock after inactivity</Label>
                      <Select value={String(autoLockMinutes)} onValueChange={(v) => onSetAutoLockMinutes(parseInt(v, 10))}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 minute</SelectItem>
                          <SelectItem value="2">2 minutes</SelectItem>
                          <SelectItem value="5">5 minutes</SelectItem>
                          <SelectItem value="10">10 minutes</SelectItem>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="60">1 hour</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="text-xs flex-1" onClick={() => setSecurityMode("change")}>
                        Change password
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs" onClick={onLockNow}>
                        Lock now
                      </Button>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive w-full" onClick={() => setSecurityMode("remove")}>
                      <ShieldOff className="h-3 w-3 mr-1" />
                      Remove password
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Set a password to lock access to the app.
                    </p>
                    <Button variant="outline" size="sm" className="text-xs w-full" onClick={() => setSecurityMode("set")}>
                      Set password
                    </Button>
                  </>
                )}
              </div>
            )}

            {securityMode === "set" && (
              <div className="space-y-2">
                <Input type="password" placeholder="New password" value={newPw} onChange={(e) => { setNewPw(e.target.value); setError(""); }} className="h-8 text-xs" autoFocus />
                <Input type="password" placeholder="Confirm password" value={confirmPw} onChange={(e) => { setConfirmPw(e.target.value); setError(""); }} className="h-8 text-xs" />
                {error && <p className="text-xs text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button size="sm" className="text-xs flex-1" onClick={handleSetPassword}>Set password</Button>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={resetSecurity}>Cancel</Button>
                </div>
              </div>
            )}

            {securityMode === "change" && (
              <div className="space-y-2">
                <Input type="password" placeholder="Current password" value={currentPw} onChange={(e) => { setCurrentPw(e.target.value); setError(""); }} className="h-8 text-xs" autoFocus />
                <Input type="password" placeholder="New password" value={newPw} onChange={(e) => { setNewPw(e.target.value); setError(""); }} className="h-8 text-xs" />
                <Input type="password" placeholder="Confirm new password" value={confirmPw} onChange={(e) => { setConfirmPw(e.target.value); setError(""); }} className="h-8 text-xs" />
                {error && <p className="text-xs text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button size="sm" className="text-xs flex-1" onClick={handleChangePassword}>Change</Button>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={resetSecurity}>Cancel</Button>
                </div>
              </div>
            )}

            {securityMode === "remove" && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Enter your current password to remove the lock.</p>
                <Input type="password" placeholder="Current password" value={currentPw} onChange={(e) => { setCurrentPw(e.target.value); setError(""); }} className="h-8 text-xs" autoFocus />
                {error && <p className="text-xs text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button variant="destructive" size="sm" className="text-xs flex-1" onClick={handleRemovePassword}>Remove lock</Button>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={resetSecurity}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
