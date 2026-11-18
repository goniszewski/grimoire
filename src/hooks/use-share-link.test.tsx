import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { useShareLink } from "./use-share-link";

// Plain function behind the mock so a rejection is not seen as unhandled by vi.fn result tracking.
let findImpl: (url: string) => Promise<unknown> = async () => null;
const find = vi.fn();
vi.mock("@/lib/share-link", async (orig) => ({
  ...(await orig<typeof import("@/lib/share-link")>()),
  findActiveBookmarkByUrl: (url: string) => {
    find(url);
    return findImpl(url);
  },
}));

function Harness(props: Parameters<typeof useShareLink>[0]) {
  useShareLink(props);
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
}

function setup(entry: string, enabled = true) {
  const onAdd = vi.fn();
  const onEditExisting = vi.fn();
  const view = render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="*" element={<Harness enabled={enabled} onAdd={onAdd} onEditExisting={onEditExisting} />} />
      </Routes>
    </MemoryRouter>,
  );
  return { onAdd, onEditExisting, ...view };
}

describe("useShareLink", () => {
  beforeEach(() => {
    find.mockReset();
    findImpl = async () => null;
  });

  it("opens a prefilled add dialog and clears the params", async () => {
    findImpl = async () => null;
    const { onAdd, onEditExisting, getByTestId } = setup("/add?url=https%3A%2F%2Fexample.com&title=T&tags=a");
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith({ url: "https://example.com", title: "T", notes: "", tags: ["a"] }));
    expect(onEditExisting).not.toHaveBeenCalled();
    expect(getByTestId("loc").textContent).toBe("/");
  });

  it("opens the existing bookmark in edit mode when the URL is already saved", async () => {
    const existing = { id: "b1", url: "https://example.com" };
    findImpl = async () => existing;
    const { onAdd, onEditExisting } = setup("/add?url=https%3A%2F%2Fexample.com&title=Ignored");
    await waitFor(() => expect(onEditExisting).toHaveBeenCalledWith(existing));
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("falls back to the add dialog when the lookup fails", async () => {
    findImpl = () => Promise.reject(new Error("offline"));
    const { onAdd } = setup("/add?url=https%3A%2F%2Fexample.com");
    await waitFor(() => expect(onAdd).toHaveBeenCalled());
  });

  it("opens an empty add dialog for an unusable link and never looks up unsafe URLs", async () => {
    const { onAdd } = setup("/add?url=javascript%3Aalert(1)");
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith(null));
    expect(find).not.toHaveBeenCalled();
  });

  it("does nothing off the /add route or while disabled", async () => {
    const a = setup("/?url=https%3A%2F%2Fexample.com");
    const b = setup("/add?url=https%3A%2F%2Fexample.com", false);
    await new Promise((r) => setTimeout(r, 20));
    expect(a.onAdd).not.toHaveBeenCalled();
    expect(b.onAdd).not.toHaveBeenCalled();
  });
});
