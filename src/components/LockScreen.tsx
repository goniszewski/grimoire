import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Flame, Lock } from "lucide-react";

interface LockScreenProps {
  onUnlock: (password: string) => Promise<boolean>;
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError(false);
    const success = await onUnlock(password);
    if (!success) {
      setError(true);
      setPassword("");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center">
      <div className="w-full max-w-xs space-y-8 px-4">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
            <Flame className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Grimoire</h1>
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            <Lock className="h-3 w-3" />
            App is locked
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(false);
            }}
            autoFocus
            className={error ? "border-destructive focus-visible:ring-destructive" : ""}
          />
          {error && (
            <p className="text-xs text-destructive text-center">Incorrect password</p>
          )}
          <Button type="submit" className="w-full" disabled={loading || !password.trim()}>
            {loading ? "Checking..." : "Unlock"}
          </Button>
        </form>
      </div>
    </div>
  );
}
