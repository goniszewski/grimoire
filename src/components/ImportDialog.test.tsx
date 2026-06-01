import { useState } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ImportDialog } from "./ImportDialog";
import type { ImportPreview } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  importBookmarksFile: vi.fn(),
  previewImportBookmarksFile: vi.fn(),
  subscribeToImportProgress: vi.fn(),
}));

import * as api from "@/lib/api";

function mockResolved(fn: unknown, value: unknown) {
  (fn as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue(value);
}

function mockResolvedOnce(fn: unknown, value: unknown) {
  (fn as { mockResolvedValueOnce: (value: unknown) => void }).mockResolvedValueOnce(value);
}

function mockRejectedOnce(fn: unknown, value: unknown) {
  (fn as { mockRejectedValueOnce: (value: unknown) => void }).mockRejectedValueOnce(value);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function mockPreview(overrides: Partial<ImportPreview["summary"]> = {}): ImportPreview {
  return {
    duplicatePolicy: {
      active: "skip",
      archived: "skip",
      trashed: "skip",
    },
    summary: {
      totalRows: 5,
      importableRows: 3,
      new: 1,
      activeDuplicates: 1,
      archivedDuplicates: 1,
      trashedDuplicates: 0,
      invalidUrls: 1,
      privateUrls: 1,
      created: 1,
      merged: 0,
      restored: 0,
      skipped: 4,
      ...overrides,
    },
    folders: [["Research"], ["Research", "AI"]],
    tags: ["ai", "typescript"],
    warnings: ["Skipped malformed URL near position 20"],
    rows: [
      {
        classification: "new",
        action: "create",
        url: "https://new.example.com",
        title: "New Row",
        notes: null,
        tags: ["ai"],
        folders: ["Research"],
        existingBookmarkId: null,
        existingState: null,
        skipReason: null,
      },
      {
        classification: "active_duplicate",
        action: "skip",
        url: "https://existing.example.com",
        title: "Existing Row",
        notes: null,
        tags: ["typescript"],
        folders: ["Research", "AI"],
        existingBookmarkId: "bm-existing",
        existingState: "active",
        skipReason: "active_duplicate",
      },
      {
        classification: "invalid_url",
        action: "skip",
        url: "notaurl",
        title: "Broken Row",
        notes: null,
        tags: [],
        folders: [],
        existingBookmarkId: null,
        existingState: null,
        skipReason: "Skipped malformed URL near position 20",
      },
    ],
  };
}

function uploadFile(file = new File(["<DL><p></DL>"], "bookmarks.html", { type: "text/html" })) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
  return file;
}

describe("ImportDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolved(api.previewImportBookmarksFile, { data: mockPreview() });
  });

  it("previews the selected import file before committing data", async () => {
    const onImport = vi.fn();
    const onOpenChange = vi.fn();
    render(<ImportDialog open onOpenChange={onOpenChange} onImport={onImport} />);

    const file = uploadFile();

    expect(await screen.findByText("Import Preview")).toBeInTheDocument();
    expect(api.previewImportBookmarksFile).toHaveBeenCalledWith(file, {
      active: "skip",
      archived: "skip",
      trashed: "skip",
    });
    expect(screen.getAllByText("1 new").length).toBeGreaterThan(0);
    expect(screen.getByText("1 active duplicate")).toBeInTheDocument();
    expect(screen.getByText("1 invalid URL")).toBeInTheDocument();
    expect(screen.getByText("1 private URL")).toBeInTheDocument();
    expect(screen.getAllByText("Research / AI").length).toBeGreaterThan(0);
    expect(screen.getByText("#typescript")).toBeInTheDocument();
    expect(api.importBookmarksFile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.importBookmarksFile).not.toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("refreshes preview estimates when duplicate policy changes", async () => {
    mockResolved(api.previewImportBookmarksFile, { data: mockPreview({ merged: 0, skipped: 4 }) });
    mockResolvedOnce(api.previewImportBookmarksFile, { data: mockPreview({ merged: 0, skipped: 4 }) });
    mockResolvedOnce(api.previewImportBookmarksFile, {
      data: {
        ...mockPreview({ merged: 1, skipped: 3 }),
        duplicatePolicy: { active: "merge", archived: "skip", trashed: "skip" },
        rows: [
          {
            ...mockPreview().rows[1],
            action: "merge",
            skipReason: null,
          },
        ],
      },
    });
    render(<ImportDialog open onOpenChange={vi.fn()} onImport={vi.fn()} />);
    const file = uploadFile();

    await screen.findByText("Import Preview");
    fireEvent.change(screen.getByLabelText("Active duplicates"), { target: { value: "merge" } });

    await waitFor(() => {
      expect(api.previewImportBookmarksFile).toHaveBeenLastCalledWith(file, {
        active: "merge",
        archived: "skip",
        trashed: "skip",
      });
    });
    expect(await screen.findByText("1 merge")).toBeInTheDocument();
  });

  it("commits the selected policy only after confirmation and reports final progress", async () => {
    mockResolved(api.importBookmarksFile, {
      data: {
        importId: "import-1",
        total: 5,
        folders: 2,
        warnings: 1,
        duplicatePolicy: { active: "skip", archived: "skip", trashed: "skip" },
        progressUrl: "/import/import-1/progress",
      },
    });
    (api.subscribeToImportProgress as unknown as { mockImplementation: (fn: unknown) => void }).mockImplementation(
      (_importId: string, onProgress: (state: unknown) => void) => {
        onProgress({
          queued: 1,
          skipped: 4,
          merged: 0,
          restored: 0,
          total: 5,
          folders: 2,
          categoriesCreated: 2,
          categoriesReused: 0,
          done: true,
          error: null,
        });
        return vi.fn();
      }
    );
    const onImport = vi.fn();
    render(<ImportDialog open onOpenChange={vi.fn()} onImport={onImport} />);
    const file = uploadFile();

    await screen.findByText("Import Preview");
    fireEvent.click(screen.getByRole("button", { name: "Import 1 item" }));

    await waitFor(() => {
      expect(api.importBookmarksFile).toHaveBeenCalledWith(file, {
        active: "skip",
        archived: "skip",
        trashed: "skip",
      });
    });
    expect(api.subscribeToImportProgress).toHaveBeenCalledWith("import-1", expect.any(Function));
    expect(await screen.findByText("Import complete")).toBeInTheDocument();
    expect(screen.getByText("1 created, 4 skipped")).toBeInTheDocument();
    expect(onImport).toHaveBeenCalled();
  });

  it("shows preview errors for malformed import files without committing data", async () => {
    mockRejectedOnce(api.previewImportBookmarksFile, new Error("Invalid bookmark export"));
    const onImport = vi.fn();
    render(<ImportDialog open onOpenChange={vi.fn()} onImport={onImport} />);

    uploadFile(new File(["not a bookmark export"], "broken.html", { type: "text/html" }));

    expect(await screen.findByText("Import failed")).toBeInTheDocument();
    expect(screen.getByText("Invalid bookmark export")).toBeInTheDocument();
    expect(api.importBookmarksFile).not.toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
  });

  it("ignores stale preview responses after the dialog closes", async () => {
    const pendingPreview = deferred<{ data: ImportPreview }>();
    (api.previewImportBookmarksFile as unknown as { mockReturnValueOnce: (value: unknown) => void }).mockReturnValueOnce(
      pendingPreview.promise
    );

    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Reopen import
          </button>
          <ImportDialog open={open} onOpenChange={setOpen} onImport={vi.fn()} />
        </>
      );
    }

    render(<Harness />);
    uploadFile();
    await waitFor(() => expect(api.previewImportBookmarksFile).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    await act(async () => {
      pendingPreview.resolve({ data: mockPreview() });
      await pendingPreview.promise;
    });

    await waitFor(() => expect(screen.queryByRole("heading", { name: /import bookmarks/i })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Reopen import" }));

    expect(await screen.findByText("Drop your bookmark file here")).toBeInTheDocument();
    expect(screen.queryByText("Import Preview")).not.toBeInTheDocument();
  });
});
