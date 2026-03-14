# First-Run Experience & Degraded Mode UI — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish first-launch scenarios by adding an empty-library onboarding state, a dismissible degraded-mode banner when no AI provider is configured, a cold-start guard on the Review Queue page, and a Playwright test verifying the daemon offline banner.

**Architecture:** All changes are pure frontend (no daemon changes needed). The degraded banner reads `GET /settings` via a new `useSettings` hook. The cold-start guard in ReviewQueue reads total bookmark count from `useBookmarks`. The empty-library state already exists inline in `Index.tsx` — we extract it into a component. The offline banner verification is a new Playwright test alongside `e2e/core-journey.spec.ts`.

**Tech Stack:** React 18, TanStack Query v5, Tailwind v3, shadcn/ui (Alert component), Playwright, Vitest

---

## Key file map

| File | Role |
|---|---|
| `src/pages/Index.tsx` | Main feed page — hosts empty-library state + degraded banner |
| `src/pages/ReviewQueue.tsx` | Review Queue — needs cold-start guard |
| `src/components/DaemonOfflineBanner.tsx` | Existing offline banner — verify only |
| `src/components/DegradedModeBanner.tsx` | **New** — AI-provider-missing dismissible banner |
| `src/hooks/use-settings.ts` | **New** — wraps `GET /settings` via TanStack Query |
| `e2e/core-journey.spec.ts` | Existing Playwright spec — add daemon-offline test |
| `e2e/first-run.spec.ts` | **New** — empty-state → add → gone; degraded banner; cold-start guard |

---

## Task 1: Create `useSettings` hook

**Files:**
- Create: `src/hooks/use-settings.ts`

This hook wraps `GET /settings` so multiple components can read AI provider status without duplicating fetch logic.

**Step 1: Write the file**

```ts
// src/hooks/use-settings.ts
import { useQuery } from "@tanstack/react-query";
import { getSettings, ApiSettings } from "@/lib/api";

export const settingsKeys = {
  all: ["settings"] as const,
};

export function useSettings() {
  const query = useQuery({
    queryKey: settingsKeys.all,
    queryFn: getSettings,
    staleTime: 60_000,
    // Don't throw — degrade gracefully when daemon is offline
    retry: 1,
  });

  const aiProvider = query.data?.data?.ai?.provider ?? null;
  const aiEnabled = aiProvider !== null && aiProvider !== "none";

  return {
    settings: query.data?.data ?? null,
    aiProvider,
    aiEnabled,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/robert/Documents/repos/goniszewski/little-imp && npx tsc --noEmit`
Expected: no errors (or pre-existing errors only, none new)

**Step 3: Commit**

```bash
git add src/hooks/use-settings.ts
git commit -m "feat(settings): add useSettings hook wrapping GET /settings"
```

---

## Task 2: Create `DegradedModeBanner` component

**Files:**
- Create: `src/components/DegradedModeBanner.tsx`

The banner shows when `aiEnabled === false`, is dismissible, persists dismiss state in `localStorage` under key `degraded_banner_dismissed`, and re-shows if provider is later reset to `"none"`.

**Step 1: Write the component**

```tsx
// src/components/DegradedModeBanner.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Info, X } from "lucide-react";

const STORAGE_KEY = "degraded_banner_dismissed";

interface DegradedModeBannerProps {
  aiEnabled: boolean;
}

export function DegradedModeBanner({ aiEnabled }: DegradedModeBannerProps) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  // Re-show if AI was previously disabled, then enabled, then disabled again.
  // We track the last known provider state to detect resets.
  useEffect(() => {
    if (aiEnabled) {
      // Provider is now configured — clear the dismiss flag so banner can
      // reappear if it later gets disabled again.
      localStorage.removeItem(STORAGE_KEY);
      setDismissed(false);
    }
  }, [aiEnabled]);

  if (aiEnabled || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  };

  return (
    <div
      role="status"
      aria-label="AI enrichment disabled"
      className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs px-4 py-2 mx-4 mt-3 rounded-md"
    >
      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <span className="flex-1">
        AI enrichment is disabled. Keyword search works —{" "}
        <button
          onClick={() => navigate("/settings")}
          className="underline underline-offset-2 hover:no-underline font-medium"
        >
          configure an AI provider in Settings
        </button>{" "}
        to enable summaries, tags, and semantic search.
      </span>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="shrink-0 opacity-70 hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/robert/Documents/repos/goniszewski/little-imp && npx tsc --noEmit`
Expected: no new errors

**Step 3: Commit**

```bash
git add src/components/DegradedModeBanner.tsx
git commit -m "feat(ui): add DegradedModeBanner component for missing AI provider"
```

---

## Task 3: Wire `DegradedModeBanner` into `Index.tsx`

**Files:**
- Modify: `src/pages/Index.tsx`

**Step 1: Add import at top of Index.tsx**

In `src/pages/Index.tsx`, after the existing `DaemonOfflineBanner` import line (line 14), add:

```tsx
import { DegradedModeBanner } from "@/components/DegradedModeBanner";
import { useSettings } from "@/hooks/use-settings";
```

**Step 2: Call the hook inside the `Index` component**

Inside `const Index = () => {`, after the line `const appLock = useAppLock();` (line 54), add:

```tsx
const { aiEnabled, isLoading: settingsLoading } = useSettings();
```

**Step 3: Render the banner below `DaemonOfflineBanner`**

In the JSX, the existing `<DaemonOfflineBanner online={online} loading={daemonChecking} />` is at line 227. Immediately after that line add:

```tsx
{!settingsLoading && <DegradedModeBanner aiEnabled={aiEnabled} />}
```

**Step 4: Verify TypeScript compiles**

Run: `cd /Users/robert/Documents/repos/goniszewski/little-imp && npx tsc --noEmit`
Expected: no new errors

**Step 5: Commit**

```bash
git add src/pages/Index.tsx
git commit -m "feat(ui): show DegradedModeBanner on main feed when AI provider is none"
```

---

## Task 4: Cold-start guard in `ReviewQueue.tsx`

**Files:**
- Modify: `src/pages/ReviewQueue.tsx`

When the library has fewer than 20 bookmarks, the Review Queue should show an informational message instead of the suggestions list. The total count comes from the `/bookmarks` list query — we'll use a light query (limit=1, just to get the pagination total).

**Step 1: Add a bookmark count query inside `ReviewQueue`**

In `src/pages/ReviewQueue.tsx`, add import at the top:

```tsx
import { useQuery } from "@tanstack/react-query";
import { listBookmarks } from "@/lib/api";
import { BookMarked } from "lucide-react";
```

(Note: `BookMarked` is the Lucide icon — if it doesn't exist in the installed version, use `Bookmark` instead — check with `grep -r "from 'lucide-react'" src/pages/ReviewQueue.tsx`)

**Step 2: Add count query inside the `ReviewQueue` function**

After `const { suggestions, pendingCount, isLoading, isError, accept, reject } = useSuggestions();` add:

```tsx
const bookmarkCountQuery = useQuery({
  queryKey: ["bookmarks", "count-for-cold-start"],
  queryFn: () => listBookmarks({ limit: 1 }),
  staleTime: 60_000,
});
const bookmarkTotal = bookmarkCountQuery.data?.pagination?.total ?? null;
const isColdStart = bookmarkTotal !== null && bookmarkTotal < 20;
```

**Step 3: Add cold-start UI in JSX**

In the `<main>` block of `ReviewQueue`, after the `isError` block (around line 163) and before the empty suggestions block, insert:

```tsx
{!isLoading && !isError && isColdStart && (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <Inbox className="h-12 w-12 text-muted-foreground/30 mb-4" />
    <h3 className="font-medium text-muted-foreground mb-1">Almost there!</h3>
    <p className="text-sm text-muted-foreground/60 max-w-sm">
      The organisation agent needs at least 20 bookmarks before it can make
      suggestions. Keep saving! ({bookmarkTotal ?? 0}/20 saved)
    </p>
  </div>
)}
```

**Step 4: Gate the suggestions list behind `!isColdStart`**

Change the final block condition from:

```tsx
{!isLoading && !isError && suggestions.length > 0 && (
```

to:

```tsx
{!isLoading && !isError && !isColdStart && suggestions.length > 0 && (
```

Also gate the "all caught up" empty state:

```tsx
{!isLoading && !isError && !isColdStart && suggestions.length === 0 && (
```

**Step 5: Verify TypeScript compiles**

Run: `cd /Users/robert/Documents/repos/goniszewski/little-imp && npx tsc --noEmit`
Expected: no new errors

**Step 6: Commit**

```bash
git add src/pages/ReviewQueue.tsx
git commit -m "feat(ui): add cold-start guard to Review Queue (< 20 bookmarks)"
```

---

## Task 5: Playwright test — empty-state → add → gone

**Files:**
- Create: `e2e/first-run.spec.ts`

This spec file covers: empty library state with both CTAs visible, adding a bookmark removes the empty state, and the degraded banner appears when AI provider is `"none"`.

The mock pattern follows `e2e/core-journey.spec.ts` exactly (see `setupDaemonMocks`).

**Step 1: Write the spec**

```ts
// e2e/first-run.spec.ts
import { test, expect, type Page } from "@playwright/test";

const BASE = "http://127.0.0.1:3210";

function makeBookmark(overrides: Record<string, unknown> = {}) {
  return {
    id: "bm-first-1",
    url: "https://example.com/article",
    domain: "example.com",
    title: "Example Article",
    description: null,
    status: "saved",
    category_id: null,
    favicon_url: null,
    screenshot_url: null,
    is_pinned: 0,
    is_archived: 0,
    is_trashed: 0,
    trashed_at: null,
    read_at: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: [],
    ...overrides,
  };
}

async function setupBaseMocks(
  page: Page,
  bookmarks: unknown[],
  aiProvider: "openai" | "ollama" | "none" = "none"
) {
  await page.route(`${BASE}/health`, (route) =>
    route.fulfill({ json: { status: "ok", version: "0.0.0", uptime: 1, queueSize: 0 } })
  );
  await page.route(`${BASE}/categories`, (route) =>
    route.fulfill({ json: { data: [] } })
  );
  await page.route(`${BASE}/domains**`, (route) =>
    route.fulfill({ json: { data: [] } })
  );
  await page.route(`${BASE}/tags**`, (route) =>
    route.fulfill({ json: { data: [] } })
  );
  await page.route(`${BASE}/suggestions**`, (route) =>
    route.fulfill({ json: { data: [], meta: { pending: 0, total: 0 } } })
  );
  await page.route(`${BASE}/settings`, (route) =>
    route.fulfill({
      json: {
        data: {
          ai: { provider: aiProvider, openai: { api_key: "", model: "" }, ollama: { base_url: "", model: "" } },
          embedding: { provider: "none", openai: { api_key: "", model: "" }, ollama: { base_url: "", model: "" } },
        },
      },
    })
  );
  await page.route(`${BASE}/bookmarks**`, async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      return route.fulfill({
        json: { data: [...bookmarks], pagination: { total: bookmarks.length, limit: 200, offset: 0, has_more: false } },
      });
    }
    if (method === "POST") {
      const body = route.request().postDataJSON();
      const bm = makeBookmark({ url: body.url, domain: new URL(body.url).hostname, title: "Example Article" });
      bookmarks.push(bm);
      return route.fulfill({ status: 201, json: { data: bm } });
    }
    return route.continue();
  });
}

test.describe("First-run experience", () => {
  test("empty library shows onboarding state with both CTAs", async ({ page }) => {
    await setupBaseMocks(page, []);
    await page.goto("/");

    await expect(page.getByText(/your library is empty/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /add your first bookmark/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /import from browser/i })).toBeVisible();
  });

  test("adding a bookmark removes the empty-state", async ({ page }) => {
    const bookmarks: unknown[] = [];
    await setupBaseMocks(page, bookmarks);
    await page.goto("/");

    await expect(page.getByText(/your library is empty/i)).toBeVisible({ timeout: 10_000 });

    // Click the primary CTA to open the dialog
    await page.getByRole("button", { name: /add your first bookmark/i }).click();
    await expect(page.getByPlaceholder("https://example.com/article")).toBeVisible();

    await page.getByPlaceholder("https://example.com/article").fill("https://example.com/article");
    await page.getByRole("button", { name: /save bookmark/i }).click();

    // Dialog closes, empty state disappears
    await expect(page.getByText(/your library is empty/i)).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Example Article")).toBeVisible({ timeout: 5_000 });
  });

  test("degraded banner appears when AI provider is none", async ({ page }) => {
    await setupBaseMocks(page, [], "none");
    await page.goto("/");

    await expect(
      page.getByText(/AI enrichment is disabled/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("degraded banner is dismissible and stays dismissed on reload", async ({ page }) => {
    await setupBaseMocks(page, [], "none");
    await page.goto("/");

    await expect(page.getByText(/AI enrichment is disabled/i)).toBeVisible({ timeout: 10_000 });

    // Dismiss
    await page.getByRole("button", { name: /dismiss/i }).click();
    await expect(page.getByText(/AI enrichment is disabled/i)).not.toBeVisible();

    // Reload — should still be dismissed (localStorage persisted)
    await page.reload();
    await page.waitForTimeout(1000); // let queries settle
    await expect(page.getByText(/AI enrichment is disabled/i)).not.toBeVisible();
  });

  test("degraded banner does NOT appear when AI provider is configured", async ({ page }) => {
    await setupBaseMocks(page, [], "openai");
    await page.goto("/");

    // Give time for settings to load
    await page.waitForTimeout(1500);
    await expect(page.getByText(/AI enrichment is disabled/i)).not.toBeVisible();
  });
});

test.describe("Review Queue cold-start guard", () => {
  async function setupReviewMocks(page: Page, bookmarkTotal: number) {
    await page.route(`${BASE}/health`, (route) =>
      route.fulfill({ json: { status: "ok", version: "0.0.0", uptime: 1, queueSize: 0 } })
    );
    await page.route(`${BASE}/suggestions**`, (route) =>
      route.fulfill({ json: { data: [], meta: { pending: 0 } } })
    );
    await page.route(`${BASE}/bookmarks**`, (route) =>
      route.fulfill({
        json: {
          data: [],
          pagination: { total: bookmarkTotal, limit: 1, offset: 0, has_more: bookmarkTotal > 1 },
        },
      })
    );
  }

  test("shows cold-start message when < 20 bookmarks", async ({ page }) => {
    await setupReviewMocks(page, 5);
    await page.goto("/review");

    await expect(
      page.getByText(/needs at least 20 bookmarks/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("does NOT show cold-start message when >= 20 bookmarks", async ({ page }) => {
    await setupReviewMocks(page, 25);
    await page.goto("/review");

    await page.waitForTimeout(1000);
    await expect(page.getByText(/needs at least 20 bookmarks/i)).not.toBeVisible();
  });
});

test.describe("Daemon offline banner", () => {
  test("shows offline banner when daemon is unreachable on first launch", async ({ page }) => {
    // Make all daemon requests fail (network error)
    await page.route(`${BASE}/**`, (route) => route.abort("connectionrefused"));

    await page.goto("/");

    // DaemonOfflineBanner should appear once loading resolves
    await expect(
      page.getByText(/daemon offline/i)
    ).toBeVisible({ timeout: 15_000 });
  });
});
```

**Step 2: Run the tests (expect failures for unimplemented parts)**

Run: `npx playwright test e2e/first-run.spec.ts --reporter=list`

The daemon offline test should pass (banner already exists). The first-run tests should pass once Tasks 1–4 are complete.

**Step 3: Commit**

```bash
git add e2e/first-run.spec.ts
git commit -m "test(e2e): add first-run experience + degraded mode + cold-start Playwright tests"
```

---

## Task 6: Run full Playwright suite and verify

**Step 1: Run all e2e tests**

Run: `npx playwright test --reporter=list`
Expected: all tests pass (or pre-existing failures only)

**Step 2: If the Review Queue route is `/review-queue` not `/review`, check the router**

Run: `grep -r "review" src/App.tsx src/main.tsx`

Look for the actual route path and correct the `page.goto("/review")` call in `e2e/first-run.spec.ts` if needed.

**Step 3: Final commit if any route fix was needed**

```bash
git add e2e/first-run.spec.ts
git commit -m "test(e2e): fix review-queue route path in first-run spec"
```

---

## Task 7: TypeScript final check

**Step 1: Full typecheck**

Run: `cd /Users/robert/Documents/repos/goniszewski/little-imp && npx tsc --noEmit`
Expected: exit 0 (zero new errors introduced by this work)

---

## Acceptance checklist

- [ ] `src/hooks/use-settings.ts` exists and wraps `GET /settings`
- [ ] `src/components/DegradedModeBanner.tsx` exists and renders only when `aiEnabled === false`
- [ ] `src/pages/Index.tsx` renders `<DegradedModeBanner>` below `<DaemonOfflineBanner>`
- [ ] Dismiss persists in `localStorage` key `degraded_banner_dismissed`
- [ ] `src/pages/ReviewQueue.tsx` shows cold-start message when bookmark total < 20
- [ ] `e2e/first-run.spec.ts` covers: empty state, add → gone, degraded banner, dismiss persistence, cold-start
- [ ] `e2e/first-run.spec.ts` covers daemon offline banner
- [ ] All Playwright tests pass
- [ ] `npx tsc --noEmit` passes
