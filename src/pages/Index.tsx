import { useState, useEffect, useCallback } from "react";
import { useAppLock } from "@/hooks/use-app-lock";
import { LockScreen } from "@/components/LockScreen";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { SearchBar } from "@/components/SearchBar";
import { BookmarkCard } from "@/components/BookmarkCard";
import { BookmarkDetail } from "@/components/BookmarkDetail";
import { AddBookmarkDialog } from "@/components/AddBookmarkDialog";
import { ImportDialog } from "@/components/ImportDialog";
import { AIPalette } from "@/components/AIPalette";
import { useBookmarks, useRelatedBookmarks } from "@/hooks/use-bookmarks";
import { useDaemonStatus } from "@/hooks/use-daemon-status";
import { DaemonOfflineBanner } from "@/components/DaemonOfflineBanner";
import { DegradedModeBanner } from "@/components/DegradedModeBanner";
import { useSettings } from "@/hooks/use-settings";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { ExportMenu } from "@/components/ExportMenu";
import { PreferencesDialog } from "@/components/PreferencesDialog";
import { usePreferences } from "@/hooks/use-preferences";
import { UIBookmark as Bookmark } from "@/hooks/use-bookmarks";
import { ApiBookmark } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToastAction } from "@/components/ui/toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SortOption } from "@/hooks/use-bookmarks";
import { Plus, Upload, X, BookmarkIcon, ArrowUpDown, CheckSquare, Trash2, XCircle, FolderInput, Settings } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const Index = () => {
  const store = useBookmarks();
  const { online, isChecking: daemonChecking } = useDaemonStatus();
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const { showButtonLabels, viewMode, updatePreferences } = usePreferences();
  const appLock = useAppLock();
  const { aiEnabled, isLoading: settingsLoading } = useSettings();

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  // Dark mode by default (only if no prior preference)
  useEffect(() => {
    if (!document.documentElement.classList.contains("light")) {
      document.documentElement.classList.add("dark");
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        setAddOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (e.key === "Escape" && selectionMode) {
        exitSelectionMode();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectionMode, exitSelectionMode]);

  // Global paste handler — auto-add valid URLs
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      const text = e.clipboardData?.getData("text/plain")?.trim();
      if (!text) return;
      try {
        const url = new URL(text);
        if (url.protocol === "http:" || url.protocol === "https:") {
          e.preventDefault();
          store.addBookmark(text);
          toast({ title: "Bookmark added", description: text });
        }
      } catch {}
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [store.addBookmark]);

  const handleDelete = (id: string) => {
    const deleted = store.deleteBookmark(id);
    if (deleted) {
      toast({
        title: "Bookmark deleted",
        description: deleted.title,
        action: (
          <ToastAction altText="Undo delete" onClick={() => store.restoreBookmark(deleted.id)}>
            Undo
          </ToastAction>
        ),
      });
    }
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(store.filteredBookmarks.map((b) => b.id)));
  }, [store.filteredBookmarks]);

  const handleBulkDelete = useCallback(() => {
    const deletedBookmarks: Bookmark[] = [];
    selectedIds.forEach((id) => {
      const deleted = store.deleteBookmark(id);
      if (deleted) deletedBookmarks.push(deleted);
    });
    const count = deletedBookmarks.length;
    toast({
      title: `${count} bookmark${count !== 1 ? "s" : ""} deleted`,
      action: (
        <ToastAction
          altText="Undo delete"
          onClick={() => deletedBookmarks.forEach((b) => store.restoreBookmark(b.id))}
        >
          Undo
        </ToastAction>
      ),
    });
    exitSelectionMode();
    setBulkDeleteOpen(false);
  }, [selectedIds, store, exitSelectionMode]);

  const handleBulkMoveCategory = useCallback((category: string) => {
    selectedIds.forEach((id) => {
      store.updateBookmarkCategory(id, category);
    });
    toast({ title: `Moved ${selectedIds.size} bookmark${selectedIds.size !== 1 ? "s" : ""} to "${category}"` });
    exitSelectionMode();
  }, [selectedIds, store, exitSelectionMode]);

  const handleOpenDetail = useCallback((bookmark: Bookmark) => {
    setSelectedBookmark(bookmark);
    setDetailOpen(true);
  }, []);

  const handlePaletteSelectBookmark = useCallback((bm: ApiBookmark) => {
    const uiBm: Bookmark = {
      id: bm.id,
      url: bm.url,
      title: bm.title ?? bm.url,
      rawTitle: bm.title,
      summary: bm.description ?? "",
      domain: bm.domain,
      favicon: bm.favicon_url ?? `https://www.google.com/s2/favicons?domain=${bm.domain}&sz=32`,
      tags: bm.tags,
      category: "Uncategorized",
      category_id: bm.category_id,
      status: bm.status,
      savedAt: bm.created_at,
      updatedAt: bm.updated_at,
      is_pinned: bm.is_pinned,
      is_archived: bm.is_archived,
      read_at: bm.read_at,
      notes: bm.notes,
    };
    handleOpenDetail(uiBm);
  }, [handleOpenDetail]);

  const relatedBookmarks = useRelatedBookmarks(selectedBookmark?.id);

  const activeFilters = [
    store.selectedCategory && { label: store.selectedCategory, clear: () => store.setSelectedCategory(null) },
    store.selectedDomain && { label: store.selectedDomain, clear: () => store.setSelectedDomain(null) },
    store.selectedTag && { label: `#${store.selectedTag}`, clear: () => store.setSelectedTag(null) },
    (store.dateRange.from || store.dateRange.to) && {
      label: "Date range",
      clear: () => store.setDateRange({ from: null, to: null }),
    },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  if (appLock.locked) {
    return <LockScreen onUnlock={appLock.unlock} />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar
          categories={store.categories}
          tags={store.tags}
          domains={store.domains}
          selectedCategory={store.selectedCategory}
          selectedTag={store.selectedTag}
          selectedDomain={store.selectedDomain}
          onSelectCategory={store.setSelectedCategory}
          onSelectTag={store.setSelectedTag}
          onSelectDomain={store.setSelectedDomain}
          totalCount={store.bookmarks.length}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <DaemonOfflineBanner online={online} loading={daemonChecking} />
          {!settingsLoading && <DegradedModeBanner aiEnabled={aiEnabled} />}
          {/* Header */}
          <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/80 backdrop-blur-sm px-4 py-3">
            <SidebarTrigger className="shrink-0" />
            <div className="flex-1">
              <SearchBar
                value={store.searchQuery}
                onChange={store.setSearchQuery}
                searchMode={store.searchMode}
                onSearchModeChange={store.setSearchMode}
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ThemeToggle />
              <ExportMenu
                showLabel={showButtonLabels}
                filters={{
                  tag: store.selectedTag ?? undefined,
                  category: store.selectedCategory ?? undefined,
                  domain: store.selectedDomain ?? undefined,
                  date_from: store.dateRange.from?.toISOString().slice(0, 10),
                  date_to: store.dateRange.to?.toISOString().slice(0, 10),
                }}
              />
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="hidden sm:flex">
                <Upload className="h-3.5 w-3.5" />
                {showButtonLabels && <span className="ml-1.5">Import</span>}
              </Button>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                {showButtonLabels && <span className="ml-1.5">Add</span>}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPrefsOpen(true)}>
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 p-4 sm:p-6">
            {/* Active filters */}
            {activeFilters.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-muted-foreground">Filtering by:</span>
                {activeFilters.map((f) => (
                  <Badge
                    key={f.label}
                    variant="secondary"
                    className="text-xs font-mono cursor-pointer gap-1"
                    onClick={f.clear}
                  >
                    {f.label}
                    <X className="h-3 w-3" />
                  </Badge>
                ))}
              </div>
            )}

            {/* Results count + toolbar */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground font-mono">
                  {store.filteredBookmarks.length} result{store.filteredBookmarks.length !== 1 ? "s" : ""}
                </p>
                {selectionMode && selectedIds.size > 0 && (
                  <Badge variant="secondary" className="text-xs font-mono">
                    {selectedIds.size} selected
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectionMode ? (
                  <>
                    <Button variant="outline" size="sm" onClick={selectAll} className="text-xs h-7">
                      Select all
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="text-xs h-7"
                      disabled={selectedIds.size === 0}
                      onClick={() => setBulkDeleteOpen(true)}
                    >
                      <Trash2 className="h-3 w-3 mr-1.5" />
                      Delete ({selectedIds.size})
                    </Button>
                    <Select
                      value=""
                      onValueChange={handleBulkMoveCategory}
                      disabled={selectedIds.size === 0}
                    >
                      <SelectTrigger className="h-7 w-[160px] text-xs font-mono">
                        <FolderInput className="h-3 w-3 mr-1.5 shrink-0" />
                        <span>Move to…</span>
                      </SelectTrigger>
                      <SelectContent>
                        {store.categories.map((c) => (
                          <SelectItem key={c.name} value={c.name} className="text-xs">
                            {c.name} ({c.count})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" onClick={exitSelectionMode} className="text-xs h-7">
                      <XCircle className="h-3 w-3 mr-1.5" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <DateRangeFilter
                      from={store.dateRange.from}
                      to={store.dateRange.to}
                      onChange={store.setDateRange}
                      showLabel={showButtonLabels}
                    />
                    {store.filteredBookmarks.length > 0 && (
                      <Button variant="outline" size="sm" onClick={() => setSelectionMode(true)} className="text-xs h-7">
                        <CheckSquare className="h-3 w-3" />
                        {showButtonLabels && <span className="ml-1.5">Select</span>}
                      </Button>
                    )}
                    <Select value={store.sortBy} onValueChange={(v) => store.setSortBy(v as SortOption)}>
                      <SelectTrigger className={`h-7 text-xs font-mono ${showButtonLabels ? 'w-[140px]' : 'w-[40px]'}`}>
                        <ArrowUpDown className="h-3 w-3 shrink-0" />
                        {showButtonLabels && <SelectValue />}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest" className="text-xs">Newest first</SelectItem>
                        <SelectItem value="oldest" className="text-xs">Oldest first</SelectItem>
                        <SelectItem value="title-az" className="text-xs">Title A→Z</SelectItem>
                        <SelectItem value="title-za" className="text-xs">Title Z→A</SelectItem>
                        <SelectItem value="domain-az" className="text-xs">Domain A→Z</SelectItem>
                        <SelectItem value="domain-za" className="text-xs">Domain Z→A</SelectItem>
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
            </div>

            {/* Bookmark grid */}
            {store.filteredBookmarks.length > 0 ? (
              <div className={viewMode === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                : "flex flex-col gap-2"
              }>
                {store.filteredBookmarks.map((bookmark) => (
                  <BookmarkCard
                    key={bookmark.id}
                    bookmark={bookmark}
                    onDelete={handleDelete}
                    onClick={handleOpenDetail}
                    onPin={store.pinBookmark}
                    onUnpin={store.unpinBookmark}
                    onArchive={store.archiveBookmark}
                    onMarkRead={store.markAsRead}
                    onMarkUnread={store.markAsUnread}
                    selectionMode={selectionMode}
                    selected={selectedIds.has(bookmark.id)}
                    onToggleSelect={toggleSelect}
                    searchQuery={store.searchQuery}
                    compact={viewMode === "list"}
                  />
                ))}
              </div>
            ) : store.bookmarks.length === 0 && !store.searchQuery && !store.selectedCategory && !store.selectedTag && !store.selectedDomain ? (
              /* First-run / empty library state */
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="relative mb-6">
                  <BookmarkIcon className="h-16 w-16 text-muted-foreground/20" />
                  <div className="absolute -bottom-1 -right-1 rounded-full bg-primary p-1">
                    <Plus className="h-3 w-3 text-primary-foreground" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold mb-2">Your library is empty</h3>
                <p className="text-sm text-muted-foreground max-w-xs mb-6">
                  Save links you want to read later, revisit, or organise. Paste a URL anywhere on this page to add it instantly.
                </p>
                <div className="flex gap-3">
                  <Button onClick={() => setAddOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add your first bookmark
                  </Button>
                  <Button variant="outline" onClick={() => setImportOpen(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    Import from browser
                  </Button>
                </div>
              </div>
            ) : (
              /* No results from search / filters */
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <BookmarkIcon className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-medium text-muted-foreground mb-1">No bookmarks found</h3>
                <p className="text-sm text-muted-foreground/60 max-w-sm">
                  {store.searchQuery
                    ? `No results for "${store.searchQuery}". Try a different search term.`
                    : "No bookmarks match the active filters."}
                </p>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" onClick={() => setAddOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Add Bookmark
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Import
                  </Button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Bulk delete confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} bookmark{selectedIds.size !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {selectedIds.size} selected bookmark{selectedIds.size !== 1 ? "s" : ""}. You can undo this from the toast notification.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBulkDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialogs */}
      <AddBookmarkDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdd={store.addBookmark}
      />
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={store.importBookmarks}
      />
      <KeyboardShortcuts />
      <AIPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onSelectBookmark={handlePaletteSelectBookmark}
        onAddBookmark={() => setAddOpen(true)}
      />
      <BookmarkDetail
        bookmark={selectedBookmark}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdateTags={store.updateBookmarkTags}
        onUpdateCategory={store.updateBookmarkCategory}
        onUpdateField={store.updateBookmarkField}
        onUpdateNotes={store.updateBookmarkNotes}
        onPin={store.pinBookmark}
        onUnpin={store.unpinBookmark}
        onArchive={(id, callbacks) => store.archiveBookmark(id, {
          onSuccess: () => { setDetailOpen(false); callbacks.onSuccess(); },
          onError: callbacks.onError,
        })}
        onMarkRead={store.markAsRead}
        onMarkUnread={store.markAsUnread}
        relatedBookmarks={relatedBookmarks}
        onSelectRelated={handleOpenDetail}
      />
      <PreferencesDialog
        open={prefsOpen}
        onOpenChange={setPrefsOpen}
        showButtonLabels={showButtonLabels}
        viewMode={viewMode}
        onUpdate={updatePreferences}
        hasPassword={appLock.hasPassword}
        autoLockMinutes={appLock.autoLockMinutes}
        onSetPassword={appLock.setPassword}
        onChangePassword={appLock.changePassword}
        onRemovePassword={appLock.removePassword}
        onSetAutoLockMinutes={appLock.setAutoLockMinutes}
        onLockNow={appLock.lockNow}
      />
    </SidebarProvider>
  );
};

export default Index;
