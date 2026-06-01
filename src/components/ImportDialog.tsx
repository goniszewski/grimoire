import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  FolderTree,
  ListChecks,
  RefreshCw,
  Route,
  Tags,
  Upload,
} from "lucide-react";
import {
  importBookmarksFile,
  listCategories,
  listTags,
  previewImportBookmarksFile,
  subscribeToImportProgress,
  type ApiCategory,
  type ApiTag,
  type ImportDuplicatePolicy,
  type ImportRemappingInput,
} from "@/lib/api";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful import so the parent can refresh its list */
  onImport: () => void;
}

type ImportPhase = "idle" | "previewing" | "preview" | "uploading" | "processing" | "done" | "error";
type FullImportDuplicatePolicy = Required<ImportDuplicatePolicy>;
type ImportRowClassification =
  | "new"
  | "active_duplicate"
  | "archived_duplicate"
  | "trashed_duplicate"
  | "invalid_url"
  | "private_url";
type ImportRowAction = "create" | "skip" | "merge" | "restore_merge";
type ImportFolderMappingAction = "create" | "existing";
type ImportTagMappingAction = "new" | "existing" | "renamed" | "skipped";

interface CategoryOption {
  id: string;
  label: string;
  path: string[];
}

interface FolderRemapState {
  action: ImportFolderMappingAction;
  categoryId?: string;
  targetPath?: string;
}

interface TagRemapState {
  action: ImportTagMappingAction;
  tagId?: string;
  targetName?: string;
}

interface ImportPreviewRowView {
  classification: ImportRowClassification;
  action: ImportRowAction;
  url: string | null;
  title: string;
  notes: string | null;
  tags: string[];
  targetTags: string[];
  folders: string[];
  targetCategoryId: string | null;
  targetCategoryPath: string[];
  existingBookmarkId: string | null;
  existingState: "active" | "archived" | "trashed" | null;
  skipReason: string | null;
}

interface ImportFolderMappingView {
  sourcePath: string[];
  action: ImportFolderMappingAction;
  targetCategoryId: string | null;
  targetPath: string[];
  status: "new" | "existing";
}

interface ImportTagMappingView {
  sourceTag: string;
  action: ImportTagMappingAction;
  targetTagId: string | null;
  targetName: string | null;
  status: "new" | "existing" | "skipped";
}

interface ImportPreviewView {
  duplicatePolicy: FullImportDuplicatePolicy;
  remapping: {
    folders: ImportFolderMappingView[];
    tags: ImportTagMappingView[];
  };
  summary: {
    totalRows: number;
    importableRows: number;
    new: number;
    activeDuplicates: number;
    archivedDuplicates: number;
    trashedDuplicates: number;
    invalidUrls: number;
    privateUrls: number;
    created: number;
    merged: number;
    restored: number;
    skipped: number;
  };
  folders: string[][];
  tags: string[];
  warnings: string[];
  rows: ImportPreviewRowView[];
}

interface FinalImportProgress {
  queued: number;
  skipped: number;
  merged: number;
  restored: number;
}

const DEFAULT_DUPLICATE_POLICY: FullImportDuplicatePolicy = {
  active: "skip",
  archived: "skip",
  trashed: "skip",
};

const CLASSIFICATION_LABELS: Record<ImportRowClassification, string> = {
  new: "New",
  active_duplicate: "Active duplicate",
  archived_duplicate: "Archived duplicate",
  trashed_duplicate: "Trashed duplicate",
  invalid_url: "Invalid URL",
  private_url: "Private URL",
};

const ACTION_LABELS: Record<ImportRowAction, string> = {
  create: "Create",
  skip: "Skip",
  merge: "Merge",
  restore_merge: "Restore and merge",
};

const TAG_ACTION_LABELS: Record<ImportTagMappingAction, string> = {
  new: "Create tag",
  existing: "Use existing",
  renamed: "Rename",
  skipped: "Skip",
};

function plural(count: number, singular: string, pluralLabel = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function pathKey(path: string[]): string {
  return JSON.stringify(path);
}

function formatPath(path: string[]): string {
  return path.join(" / ");
}

function parsePathInput(value: string): string[] {
  return value
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function flattenCategories(categories: ApiCategory[], prefix: string[] = []): CategoryOption[] {
  return categories.flatMap((category) => {
    const path = [...prefix, category.name];
    return [
      {
        id: category.id,
        label: formatPath(path),
        path,
      },
      ...flattenCategories(category.children ?? [], path),
    ];
  });
}

function buildRemappingInput(
  folderMappings: Record<string, FolderRemapState>,
  tagMappings: Record<string, TagRemapState>
): ImportRemappingInput | undefined {
  const folders = Object.entries(folderMappings)
    .map(([sourceKey, mapping]) => {
      const sourcePath = JSON.parse(sourceKey) as string[];
      if (mapping.action === "existing") {
        if (!mapping.categoryId) return null;
        return {
          sourcePath,
          action: "existing" as const,
          categoryId: mapping.categoryId,
        };
      }
      const targetPath = parsePathInput(mapping.targetPath ?? formatPath(sourcePath));
      if (targetPath.length === 0) return null;
      return {
        sourcePath,
        action: "create" as const,
        targetPath,
      };
    })
    .filter((mapping): mapping is NonNullable<typeof mapping> => mapping !== null);

  const tags = Object.entries(tagMappings)
    .map(([sourceTag, mapping]) => {
      if (mapping.action === "skipped") {
        return {
          sourceTag,
          action: "skipped" as const,
        };
      }
      if (mapping.action === "existing") {
        if (!mapping.tagId) return null;
        return {
          sourceTag,
          action: "existing" as const,
          tagId: mapping.tagId,
        };
      }
      const targetName = (mapping.targetName ?? sourceTag).trim();
      if (!targetName) return null;
      return {
        sourceTag,
        action: mapping.action,
        targetName,
      };
    })
    .filter((mapping): mapping is NonNullable<typeof mapping> => mapping !== null);

  return folders.length > 0 || tags.length > 0 ? { folders, tags } : undefined;
}

function importableActionCount(preview: ImportPreviewView | null): number {
  if (!preview) return 0;
  return preview.summary.created + preview.summary.merged + preview.summary.restored;
}

function finalProgressLabel(progress: FinalImportProgress): string {
  const parts = [
    progress.queued > 0 ? plural(progress.queued, "created", "created") : null,
    progress.merged > 0 ? plural(progress.merged, "merged", "merged") : null,
    progress.restored > 0 ? plural(progress.restored, "restored", "restored") : null,
    progress.skipped > 0 ? plural(progress.skipped, "skipped", "skipped") : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "No rows changed";
}

export function ImportDialog({ open, onOpenChange, onImport }: ImportDialogProps) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [duplicatePolicy, setDuplicatePolicy] = useState<FullImportDuplicatePolicy>(DEFAULT_DUPLICATE_POLICY);
  const [preview, setPreview] = useState<ImportPreviewView | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [existingTags, setExistingTags] = useState<ApiTag[]>([]);
  const [folderMappings, setFolderMappings] = useState<Record<string, FolderRemapState>>({});
  const [tagMappings, setTagMappings] = useState<Record<string, TagRemapState>>({});
  const [finalProgress, setFinalProgress] = useState<FinalImportProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const previewRequestRef = useRef(0);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    void (async () => {
      try {
        const categoryResponse = await listCategories();
        const tagResponse = await listTags();
        if (cancelled) return;
        setCategoryOptions(flattenCategories(categoryResponse.data));
        setExistingTags(tagResponse.data);
      } catch {
        if (cancelled) return;
        setCategoryOptions([]);
        setExistingTags([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const runPreview = async (
    file: File,
    policy: FullImportDuplicatePolicy,
    nextFolderMappings = folderMappings,
    nextTagMappings = tagMappings
  ) => {
    const requestId = previewRequestRef.current + 1;
    previewRequestRef.current = requestId;
    setPhase("previewing");
    setProgress(15);
    setPreview(null);
    setFinalProgress(null);
    setErrorMsg("");

    try {
      const remapping = buildRemappingInput(nextFolderMappings, nextTagMappings);
      const result = await previewImportBookmarksFile(file, policy, remapping);
      if (previewRequestRef.current !== requestId) return;
      setPreview(result.data as ImportPreviewView);
      setDuplicatePolicy({ ...DEFAULT_DUPLICATE_POLICY, ...result.data.duplicatePolicy });
      setProgress(100);
      setPhase("preview");
    } catch (err) {
      if (previewRequestRef.current !== requestId) return;
      setErrorMsg(err instanceof Error ? err.message : "Preview failed");
      setProgress(0);
      setPhase("error");
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;

    const policy = { ...DEFAULT_DUPLICATE_POLICY };
    const emptyFolderMappings: Record<string, FolderRemapState> = {};
    const emptyTagMappings: Record<string, TagRemapState> = {};
    setSelectedFile(file);
    setDuplicatePolicy(policy);
    setFolderMappings(emptyFolderMappings);
    setTagMappings(emptyTagMappings);
    await runPreview(file, policy, emptyFolderMappings, emptyTagMappings);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    void handleFile(e.target.files?.[0]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    void handleFile(e.dataTransfer.files?.[0]);
  };

  const handlePolicyChange = (field: keyof FullImportDuplicatePolicy, value: string) => {
    const nextPolicy = {
      ...duplicatePolicy,
      [field]: value,
    } as FullImportDuplicatePolicy;
    setDuplicatePolicy(nextPolicy);
    if (selectedFile) void runPreview(selectedFile, nextPolicy);
  };

  const handleFolderMappingChange = (
    sourcePath: string[],
    patch: Partial<FolderRemapState>,
    options: { previewImmediately?: boolean } = { previewImmediately: true }
  ) => {
    const key = pathKey(sourcePath);
    const current = folderMappings[key] ?? {
      action: "create" as const,
      targetPath: formatPath(sourcePath),
    };
    const next = {
      ...folderMappings,
      [key]: {
        ...current,
        ...patch,
      },
    };
    setFolderMappings(next);
    if (selectedFile && options.previewImmediately) {
      void runPreview(selectedFile, duplicatePolicy, next, tagMappings);
    }
  };

  const handleTagMappingChange = (
    sourceTag: string,
    patch: Partial<TagRemapState>,
    options: { previewImmediately?: boolean } = { previewImmediately: true }
  ) => {
    const current = tagMappings[sourceTag] ?? {
      action: "new" as const,
      targetName: sourceTag,
    };
    const next = {
      ...tagMappings,
      [sourceTag]: {
        ...current,
        ...patch,
      },
    };
    setTagMappings(next);
    if (selectedFile && options.previewImmediately) {
      void runPreview(selectedFile, duplicatePolicy, folderMappings, next);
    }
  };

  const handleCommit = async () => {
    if (!selectedFile) return;

    setPhase("uploading");
    setProgress(20);
    setErrorMsg("");

    try {
      const remapping = buildRemappingInput(folderMappings, tagMappings);
      const result = await importBookmarksFile(selectedFile, duplicatePolicy, remapping);
      const { importId, total } = result.data;

      setProgress(30);
      setPhase("processing");

      // Subscribe to SSE progress
      cleanupRef.current = subscribeToImportProgress(importId, (state) => {
        const completed = state.queued + state.skipped + state.merged + state.restored;
        const pct = total > 0
          ? 30 + Math.round((completed / total) * 70)
          : 100;
        setProgress(Math.min(pct, 100));

        if (state.error) {
          cleanupRef.current?.();
          cleanupRef.current = null;
          setErrorMsg(state.error);
          setPhase("error");
        } else if (state.done) {
          cleanupRef.current?.();
          cleanupRef.current = null;
          setFinalProgress({
            queued: state.queued,
            skipped: state.skipped,
            merged: state.merged,
            restored: state.restored,
          });
          setProgress(100);
          setPhase("done");
          onImport();
        }
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Upload failed");
      setPhase("error");
    }
  };

  const handleClose = () => {
    previewRequestRef.current += 1;
    cleanupRef.current?.();
    cleanupRef.current = null;
    setPhase("idle");
    setProgress(0);
    setSelectedFile(null);
    setDuplicatePolicy(DEFAULT_DUPLICATE_POLICY);
    setPreview(null);
    setFolderMappings({});
    setTagMappings({});
    setFinalProgress(null);
    setErrorMsg("");
    if (fileRef.current) fileRef.current.value = "";
    onOpenChange(false);
  };

  const phaseLabel = phase === "previewing"
    ? "Analyzing bookmark file..."
    : phase === "uploading"
      ? "Uploading file..."
      : "Queuing selected import actions...";
  const actionCount = importableActionCount(preview);
  const canCommit = phase === "preview" && selectedFile !== null && actionCount > 0;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) handleClose();
      else onOpenChange(true);
    }}>
      <DialogContent className="max-h-[90vh] max-w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
        <DialogHeader className="pr-8 sm:pr-0">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Import Bookmarks
          </DialogTitle>
          <DialogDescription>
            Preview the file, choose duplicate handling, then confirm the import.
          </DialogDescription>
        </DialogHeader>

        {phase === "idle" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              className="flex w-full cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary/50"
            >
              <FileText className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Drop your bookmark file here</p>
                <p className="text-xs text-muted-foreground mt-1">
                  or click to browse (.html)
                </p>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".html,.htm"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        )}

        {(phase === "previewing" || phase === "uploading" || phase === "processing") && (
          <div className="space-y-4 py-6">
            <p className="text-sm text-muted-foreground text-center">{phaseLabel}</p>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {phase === "preview" && preview && (
          <div className="min-w-0 space-y-5 py-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <ListChecks className="h-4 w-4 text-primary" />
                  Import Preview
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedFile?.name} · {plural(preview.summary.totalRows, "row")}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => fileRef.current?.click()}
              >
                Choose another file
              </Button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".html,.htm"
              className="hidden"
              onChange={handleFileInput}
            />

            <div className="grid grid-cols-1 gap-2 min-[460px]:grid-cols-2 sm:grid-cols-4">
              <div className="min-w-0 rounded-md border border-border p-3">
                <p className="text-lg font-semibold">{preview.summary.created}</p>
                <p className="text-xs text-muted-foreground">{plural(preview.summary.created, "new", "new")}</p>
              </div>
              <div className="min-w-0 rounded-md border border-border p-3">
                <p className="text-lg font-semibold">{preview.summary.merged}</p>
                <p className="text-xs text-muted-foreground">{plural(preview.summary.merged, "merge")}</p>
              </div>
              <div className="min-w-0 rounded-md border border-border p-3">
                <p className="text-lg font-semibold">{preview.summary.restored}</p>
                <p className="text-xs text-muted-foreground">{plural(preview.summary.restored, "restore")}</p>
              </div>
              <div className="min-w-0 rounded-md border border-border p-3">
                <p className="text-lg font-semibold">{preview.summary.skipped}</p>
                <p className="text-xs text-muted-foreground">{plural(preview.summary.skipped, "skip")}</p>
              </div>
            </div>

            <div className="grid min-w-0 gap-2 text-xs sm:grid-cols-2">
              <div className="min-w-0 space-y-1 rounded-md border border-border p-3">
                <p className="font-medium">Detected rows</p>
                <p>{plural(preview.summary.new, "new", "new")}</p>
                <p>{plural(preview.summary.activeDuplicates, "active duplicate")}</p>
                <p>{plural(preview.summary.archivedDuplicates, "archived duplicate")}</p>
                <p>{plural(preview.summary.trashedDuplicates, "trashed duplicate")}</p>
                <p>{plural(preview.summary.invalidUrls, "invalid URL")}</p>
                <p>{plural(preview.summary.privateUrls, "private URL")}</p>
              </div>
              <div className="min-w-0 space-y-3 rounded-md border border-border p-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium" htmlFor="import-active-policy">
                    Active duplicates
                  </label>
                  <select
                    id="import-active-policy"
                    value={duplicatePolicy.active}
                    onChange={(event) => handlePolicyChange("active", event.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="skip">Skip</option>
                    <option value="merge">Merge tags, folder, and notes</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium" htmlFor="import-archived-policy">
                    Archived duplicates
                  </label>
                  <select
                    id="import-archived-policy"
                    value={duplicatePolicy.archived}
                    onChange={(event) => handlePolicyChange("archived", event.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="skip">Skip</option>
                    <option value="restore_merge">Restore and merge</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium" htmlFor="import-trashed-policy">
                    Trashed duplicates
                  </label>
                  <select
                    id="import-trashed-policy"
                    value={duplicatePolicy.trashed}
                    onChange={(event) => handlePolicyChange("trashed", event.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="skip">Skip</option>
                    <option value="restore_merge">Restore and merge</option>
                  </select>
                </div>
              </div>
            </div>

            {(preview.remapping.folders.length > 0 || preview.remapping.tags.length > 0) && (
              <div className="grid min-w-0 gap-2 lg:grid-cols-2">
                {preview.remapping.folders.length > 0 && (
                  <div className="min-w-0 space-y-3 rounded-md border border-border p-3">
                    <p className="flex items-center gap-2 text-xs font-medium">
                      <Route className="h-3.5 w-3.5 text-primary" />
                      Category mapping
                    </p>
                    <div className="max-h-48 space-y-3 overflow-y-auto pr-1">
                      {preview.remapping.folders.map((mapping) => {
                        const key = pathKey(mapping.sourcePath);
                        const state = folderMappings[key];
                        const action = state?.action ?? mapping.action;
                        const selectedCategoryId = state?.categoryId ?? mapping.targetCategoryId ?? categoryOptions[0]?.id ?? "";
                        const targetPath = state?.targetPath ?? formatPath(mapping.targetPath);

                        return (
                          <div key={key} className="min-w-0 space-y-2 border-b border-border pb-3 last:border-b-0 last:pb-0">
                            <div className="flex min-w-0 items-center justify-between gap-2">
                              <p className="truncate text-xs font-medium">{formatPath(mapping.sourcePath)}</p>
                              <Badge variant={mapping.status === "new" ? "secondary" : "outline"} className="shrink-0 text-[10px]">
                                {mapping.status}
                              </Badge>
                            </div>
                            <select
                              aria-label={`Category action for ${formatPath(mapping.sourcePath)}`}
                              value={action}
                              onChange={(event) => {
                                const nextAction = event.target.value as ImportFolderMappingAction;
                                handleFolderMappingChange(mapping.sourcePath, nextAction === "existing"
                                  ? {
                                      action: "existing",
                                      categoryId: mapping.targetCategoryId ?? categoryOptions[0]?.id,
                                      targetPath: undefined,
                                    }
                                  : {
                                      action: "create",
                                      categoryId: undefined,
                                      targetPath: formatPath(mapping.targetPath),
                                    });
                              }}
                              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                            >
                              <option value="create">Create or reuse path</option>
                              <option value="existing" disabled={categoryOptions.length === 0}>
                                Use existing category
                              </option>
                            </select>
                            {action === "existing" ? (
                              <select
                                aria-label={`Existing category for ${formatPath(mapping.sourcePath)}`}
                                value={selectedCategoryId}
                                onChange={(event) => handleFolderMappingChange(mapping.sourcePath, {
                                  action: "existing",
                                  categoryId: event.target.value,
                                  targetPath: undefined,
                                })}
                                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                              >
                                {categoryOptions.map((category) => (
                                  <option key={category.id} value={category.id}>
                                    {category.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                aria-label={`Target category path for ${formatPath(mapping.sourcePath)}`}
                                value={targetPath}
                                onChange={(event) => handleFolderMappingChange(mapping.sourcePath, {
                                  action: "create",
                                  targetPath: event.target.value,
                                  categoryId: undefined,
                                }, { previewImmediately: false })}
                                onBlur={() => selectedFile && void runPreview(selectedFile, duplicatePolicy)}
                                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {preview.remapping.tags.length > 0 && (
                  <div className="min-w-0 space-y-3 rounded-md border border-border p-3">
                    <p className="flex items-center gap-2 text-xs font-medium">
                      <Tags className="h-3.5 w-3.5 text-primary" />
                      Tag mapping
                    </p>
                    <div className="max-h-48 space-y-3 overflow-y-auto pr-1">
                      {preview.remapping.tags.map((mapping) => {
                        const state = tagMappings[mapping.sourceTag];
                        const action = state?.action ?? mapping.action;
                        const selectedTagId = state?.tagId ?? mapping.targetTagId ?? existingTags[0]?.id ?? "";
                        const targetName = state?.targetName ?? mapping.targetName ?? mapping.sourceTag;

                        return (
                          <div key={mapping.sourceTag} className="min-w-0 space-y-2 border-b border-border pb-3 last:border-b-0 last:pb-0">
                            <div className="flex min-w-0 items-center justify-between gap-2">
                              <p className="truncate text-xs font-medium">#{mapping.sourceTag}</p>
                              <Badge variant={mapping.status === "new" ? "secondary" : "outline"} className="shrink-0 text-[10px]">
                                {mapping.status}
                              </Badge>
                            </div>
                            <select
                              aria-label={`Tag action for ${mapping.sourceTag}`}
                              value={action}
                              onChange={(event) => {
                                const nextAction = event.target.value as ImportTagMappingAction;
                                if (nextAction === "existing") {
                                  handleTagMappingChange(mapping.sourceTag, {
                                    action: "existing",
                                    tagId: mapping.targetTagId ?? existingTags[0]?.id,
                                    targetName: undefined,
                                  });
                                  return;
                                }
                                if (nextAction === "skipped") {
                                  handleTagMappingChange(mapping.sourceTag, {
                                    action: "skipped",
                                    tagId: undefined,
                                    targetName: undefined,
                                  });
                                  return;
                                }
                                handleTagMappingChange(mapping.sourceTag, {
                                  action: nextAction,
                                  tagId: undefined,
                                  targetName: mapping.targetName ?? mapping.sourceTag,
                                });
                              }}
                              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                            >
                              <option value="new">{TAG_ACTION_LABELS.new}</option>
                              <option value="existing" disabled={existingTags.length === 0}>{TAG_ACTION_LABELS.existing}</option>
                              <option value="renamed">{TAG_ACTION_LABELS.renamed}</option>
                              <option value="skipped">{TAG_ACTION_LABELS.skipped}</option>
                            </select>
                            {action === "existing" ? (
                              <select
                                aria-label={`Existing tag for ${mapping.sourceTag}`}
                                value={selectedTagId}
                                onChange={(event) => handleTagMappingChange(mapping.sourceTag, {
                                  action: "existing",
                                  tagId: event.target.value,
                                  targetName: undefined,
                                })}
                                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                              >
                                {existingTags.map((tag) => (
                                  <option key={tag.id} value={tag.id}>
                                    #{tag.name}
                                  </option>
                                ))}
                              </select>
                            ) : action === "renamed" || action === "new" ? (
                              <input
                                aria-label={`Target tag name for ${mapping.sourceTag}`}
                                value={targetName}
                                onChange={(event) => handleTagMappingChange(mapping.sourceTag, {
                                  action,
                                  targetName: event.target.value,
                                  tagId: undefined,
                                }, { previewImmediately: false })}
                                onBlur={() => selectedFile && void runPreview(selectedFile, duplicatePolicy)}
                                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                              />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {(preview.folders.length > 0 || preview.tags.length > 0) && (
              <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                {preview.folders.length > 0 && (
                  <div className="min-w-0 space-y-2 rounded-md border border-border p-3">
                    <p className="flex items-center gap-2 text-xs font-medium">
                      <FolderTree className="h-3.5 w-3.5 text-primary" />
                      Folders
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {preview.folders.slice(0, 8).map((folder) => (
                        <Badge key={folder.join("/")} variant="secondary" className="text-[11px]">
                          {folder.join(" / ")}
                        </Badge>
                      ))}
                      {preview.folders.length > 8 && (
                        <Badge variant="outline" className="text-[11px]">
                          +{preview.folders.length - 8}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                {preview.tags.length > 0 && (
                  <div className="min-w-0 space-y-2 rounded-md border border-border p-3">
                    <p className="flex items-center gap-2 text-xs font-medium">
                      <Tags className="h-3.5 w-3.5 text-primary" />
                      Tags
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {preview.tags.slice(0, 12).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[11px]">
                          #{tag}
                        </Badge>
                      ))}
                      {preview.tags.length > 12 && (
                        <Badge variant="outline" className="text-[11px]">
                          +{preview.tags.length - 12}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="min-w-0 max-w-full overflow-x-auto rounded-md border border-border">
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full min-w-[700px] text-left text-xs">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 font-medium">Title</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Action</th>
                      <th className="px-3 py-2 font-medium">Folder</th>
                      <th className="px-3 py-2 font-medium">Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 50).map((row, index) => (
                      <tr key={`${row.url ?? row.title}-${index}`} className="border-b border-border last:border-b-0">
                        <td className="max-w-[220px] truncate px-3 py-2">{row.title || row.url || "Untitled"}</td>
                        <td className="px-3 py-2">{CLASSIFICATION_LABELS[row.classification]}</td>
                        <td className="px-3 py-2">{ACTION_LABELS[row.action]}</td>
                        <td className="max-w-[160px] truncate px-3 py-2">
                          {row.folders.length > 0 ? row.folders.join(" / ") : "Uncategorized"}
                        </td>
                        <td className="max-w-[190px] truncate px-3 py-2">
                          {[
                            row.targetCategoryPath.length > 0 ? row.targetCategoryPath.join(" / ") : null,
                            row.targetTags.length > 0 ? row.targetTags.map((tag) => `#${tag}`).join(", ") : null,
                          ].filter(Boolean).join(" · ") || "No mapping"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.rows.length > 50 && (
                  <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                    Showing first 50 rows of {preview.rows.length}.
                  </p>
                )}
              </div>
            </div>

            {preview.warnings.length > 0 && (
              <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Parser warnings</p>
                <p className="mt-1">{preview.warnings[0]}</p>
                {preview.warnings.length > 1 && <p className="mt-1">+{preview.warnings.length - 1} more</p>}
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="button" onClick={handleCommit} disabled={!canCommit}>
                {actionCount > 0 ? `Import ${plural(actionCount, "item")}` : "Nothing to import"}
              </Button>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle2 className="h-12 w-12 text-pipeline-indexed" />
            <div className="text-center">
              <p className="font-semibold">Import complete</p>
              <p className="text-sm text-muted-foreground mt-1">
                {finalProgress ? finalProgressLabel(finalProgress) : "Bookmarks queued for background processing."}
              </p>
            </div>
            <Button onClick={handleClose}>Done</Button>
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div className="text-center">
              <p className="font-semibold text-destructive">Import failed</p>
              <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
            </div>
            <div className="flex gap-2">
              {selectedFile && (
                <Button
                  variant="outline"
                  onClick={() => void runPreview(selectedFile, duplicatePolicy)}
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry preview
                </Button>
              )}
              <Button variant="outline" onClick={handleClose}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
