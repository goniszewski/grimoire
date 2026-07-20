import { useState, useEffect, useCallback, useRef } from "react";

const LOCK_HASH_KEY = "little-imp-lock-hash";
const LOCK_TIMEOUT_KEY = "little-imp-lock-timeout";
const LOCK_ENABLED_KEY = "little-imp-lock-enabled";

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getStoredHash(): string | null {
  return localStorage.getItem(LOCK_HASH_KEY);
}

function getAutoLockMinutes(): number {
  const val = localStorage.getItem(LOCK_TIMEOUT_KEY);
  return val ? parseInt(val, 10) : 5;
}

function isLockEnabled(): boolean {
  return localStorage.getItem(LOCK_ENABLED_KEY) === "true";
}

export function useAppLock() {
  const [locked, setLocked] = useState(() => {
    return isLockEnabled() && !!getStoredHash();
  });
  const [hasPassword, setHasPassword] = useState(() => !!getStoredHash());
  const [autoLockMinutes, setAutoLockMinutesState] = useState(getAutoLockMinutes);
  const [lockEnabled, setLockEnabledState] = useState(isLockEnabled);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef(Date.now());

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Inactivity auto-lock
  useEffect(() => {
    if (!lockEnabled || !hasPassword || locked) return;

    const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));

    const interval = setInterval(() => {
      const elapsed = (Date.now() - lastActivityRef.current) / 1000 / 60;
      if (elapsed >= autoLockMinutes) {
        setLocked(true);
      }
    }, 10000); // check every 10s

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      clearInterval(interval);
    };
  }, [lockEnabled, hasPassword, locked, autoLockMinutes, resetTimer]);

  const unlock = useCallback(async (password: string): Promise<boolean> => {
    const storedHash = getStoredHash();
    if (!storedHash) return true;
    const hash = await hashPassword(password);
    if (hash === storedHash) {
      setLocked(false);
      lastActivityRef.current = Date.now();
      return true;
    }
    return false;
  }, []);

  const setPassword = useCallback(async (password: string) => {
    const hash = await hashPassword(password);
    localStorage.setItem(LOCK_HASH_KEY, hash);
    localStorage.setItem(LOCK_ENABLED_KEY, "true");
    setHasPassword(true);
    setLockEnabledState(true);
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string): Promise<boolean> => {
    const storedHash = getStoredHash();
    if (!storedHash) return false;
    const currentHash = await hashPassword(currentPassword);
    if (currentHash !== storedHash) return false;
    const newHash = await hashPassword(newPassword);
    localStorage.setItem(LOCK_HASH_KEY, newHash);
    return true;
  }, []);

  const removePassword = useCallback(async (currentPassword: string): Promise<boolean> => {
    const storedHash = getStoredHash();
    if (!storedHash) return true;
    const hash = await hashPassword(currentPassword);
    if (hash !== storedHash) return false;
    localStorage.removeItem(LOCK_HASH_KEY);
    localStorage.removeItem(LOCK_ENABLED_KEY);
    setHasPassword(false);
    setLockEnabledState(false);
    setLocked(false);
    return true;
  }, []);

  const setAutoLockMinutes = useCallback((minutes: number) => {
    localStorage.setItem(LOCK_TIMEOUT_KEY, String(minutes));
    setAutoLockMinutesState(minutes);
  }, []);

  const lockNow = useCallback(() => {
    if (hasPassword && lockEnabled) {
      setLocked(true);
    }
  }, [hasPassword, lockEnabled]);

  return {
    locked,
    hasPassword,
    lockEnabled,
    autoLockMinutes,
    unlock,
    setPassword,
    changePassword,
    removePassword,
    setAutoLockMinutes,
    lockNow,
  };
}
