import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listSuggestions, createCategory, updateCategory, deleteCategory, listCategories, type ApiCategory } from "@/lib/api";
import { suggestionKeys } from "@/hooks/use-suggestions";
import { bookmarkKeys, type UICategory } from "@/hooks/use-bookmarks";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagCount, DomainCount } from "@/types/bookmark";
import { FolderOpen, Tag, Clock, Flame, Hash, Globe, ChevronDown, ChevronRight, ExternalLink, History, Bot, Plus, X, Archive, Check, Pencil, Trash2, FolderInput, Settings, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const DOMAINS_COLLAPSED_COUNT = 5;
const DOMAINS_PAGE_THRESHOLD = 20;
const TAGS_COLLAPSED_COUNT = 8;

// ── Drag-and-drop sub-components ──────────────────────────────────────────────

interface DraggableCategoryProps {
  cat: UICategory;
  collapsed: boolean;
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  onStartRename: (cat: UICategory) => void;
  onStartMove: (cat: UICategory) => void;
  onStartDelete: (cat: UICategory) => void;
  isDragging: boolean;
  isDropTarget: boolean;
  isDraggingAny: boolean;
}

function DraggableCategory({
  cat,
  collapsed,
  selectedCategory,
  onSelectCategory,
  onStartRename,
  onStartMove,
  onStartDelete,
  isDragging,
  isDropTarget,
  isDraggingAny,
}: DraggableCategoryProps) {
  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({
    id: cat.id,
    disabled: collapsed,
  });
  const { setNodeRef: setDropRef } = useDroppable({ id: cat.id });

  const setRef = (el: HTMLElement | null) => {
    setDragRef(el);
    setDropRef(el);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setRef}
          className={cn(
            "group relative flex items-center rounded-md transition-colors",
            isDragging && "opacity-40",
            isDropTarget && "ring-2 ring-primary/60 bg-primary/10"
          )}
        >
          {!collapsed && isDraggingAny && (
            <span
              {...attributes}
              {...listeners}
              className="absolute left-0 flex items-center justify-center h-full w-5 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-3 w-3" />
            </span>
          )}
          {!collapsed && !isDraggingAny && (
            <span
              {...attributes}
              {...listeners}
              className="absolute left-0 flex items-center justify-center h-full w-5 text-muted-foreground/0 group-hover:text-muted-foreground/40 cursor-grab active:cursor-grabbing z-10 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-3 w-3" />
            </span>
          )}
          <SidebarMenuButton
            onClick={() => onSelectCategory(selectedCategory === cat.name ? null : cat.name)}
            className={cn(
              selectedCategory === cat.name && "bg-accent text-accent-foreground",
              !collapsed && "pl-6"
            )}
            tooltip={collapsed ? `${cat.name} (${cat.count})` : undefined}
          >
            {collapsed ? (
              <span className="text-[10px] font-bold uppercase shrink-0">{cat.name.slice(0, 2)}</span>
            ) : (
              <>
                <span className="text-xs truncate">{cat.name}</span>
                <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5 font-mono">
                  {cat.count}
                </Badge>
              </>
            )}
          </SidebarMenuButton>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onStartRename(cat)}>
          <Pencil className="h-3.5 w-3.5 mr-2" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onStartMove(cat)}>
          <FolderInput className="h-3.5 w-3.5 mr-2" />
          Move to…
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => onStartDelete(cat)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5 mr-2" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function RootDropZone({ isOver }: { isOver: boolean }) {
  const { setNodeRef } = useDroppable({ id: "__root__" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute inset-0 rounded-md pointer-events-none",
        isOver && "ring-2 ring-primary/60 bg-primary/10"
      )}
    />
  );
}

interface AppSidebarProps {
  categories: UICategory[];
  tags: TagCount[];
  domains: DomainCount[];
  selectedCategory: string | null;
  selectedTag: string | null;
  selectedDomain: string | null;
  onSelectCategory: (category: string | null) => void;
  onSelectTag: (tag: string | null) => void;
  onSelectDomain: (domain: string | null) => void;
  totalCount: number;
}

export function AppSidebar({
  categories,
  tags,
  domains,
  selectedCategory,
  selectedTag,
  selectedDomain,
  onSelectCategory,
  onSelectTag,
  onSelectDomain,
  totalCount,
}: AppSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const [domainsExpanded, setDomainsExpanded] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const newCategoryInputRef = useRef<HTMLInputElement>(null);

  // Rename state — tracks category id
  const [renamingCategoryId, setRenamingCategoryId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Delete state — tracks category id
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);

  // Move state — tracks category id (used by "Move to…" dropdown)
  const [movingCategoryId, setMovingCategoryId] = useState<string | null>(null);
  const [moveTargetId, setMoveTargetId] = useState<string>("");

  // Drag-and-drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const qc = useQueryClient();

  // Full category tree (needed to resolve name → id and for move targets)
  const { data: apiCategories = [] } = useQuery({
    queryKey: bookmarkKeys.categories,
    queryFn: async () => {
      const res = await listCategories();
      return res.data as unknown as ApiCategory[];
    },
    staleTime: 30_000,
  });

  // Flatten tree for move-target list
  const flatApiCategories = useMemo<ApiCategory[]>(() => {
    const result: ApiCategory[] = [];
    function walk(list: ApiCategory[]) {
      for (const c of list) {
        result.push(c);
        if (c.children) walk(c.children);
      }
    }
    walk(apiCategories);
    return result;
  }, [apiCategories]);

  function findApiCatById(id: string): ApiCategory | undefined {
    return flatApiCategories.find((c) => c.id === id);
  }

  const createCategoryMutation = useMutation({
    mutationFn: (name: string) => createCategory(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bookmarkKeys.categories });
      setAddingCategory(false);
      setNewCategoryName("");
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to create category");
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateCategory(id, { name }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: bookmarkKeys.categories });
      qc.invalidateQueries({ queryKey: bookmarkKeys.lists() });
      if (selectedCategory === findApiCatById(renamingCategoryId ?? "")?.name) {
        onSelectCategory(res.data.name);
      }
      setRenamingCategoryId(null);
      setRenameValue("");
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to rename category");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bookmarkKeys.categories });
      qc.invalidateQueries({ queryKey: bookmarkKeys.lists() });
      if (selectedCategory === findApiCatById(deletingCategoryId ?? "")?.name) {
        onSelectCategory(null);
      }
      setDeletingCategoryId(null);
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to delete category");
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, parent_id }: { id: string; parent_id: string | null }) =>
      updateCategory(id, { parent_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bookmarkKeys.categories });
      setMovingCategoryId(null);
      setMoveTargetId("");
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to move category");
    },
  });

  function handleCreateCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    createCategoryMutation.mutate(name);
  }

  function handleNewCategoryKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleCreateCategory();
    if (e.key === "Escape") {
      setAddingCategory(false);
      setNewCategoryName("");
    }
  }

  function openAddCategory() {
    setAddingCategory(true);
    setTimeout(() => newCategoryInputRef.current?.focus(), 0);
  }

  function startRename(cat: UICategory) {
    setRenamingCategoryId(cat.id);
    setRenameValue(cat.name);
    setTimeout(() => renameInputRef.current?.focus(), 0);
  }

  function commitRename() {
    const newName = renameValue.trim();
    const id = renamingCategoryId;
    if (!newName || !id) {
      setRenamingCategoryId(null);
      return;
    }
    const currentName = findApiCatById(id)?.name;
    if (newName === currentName) {
      setRenamingCategoryId(null);
      return;
    }
    renameMutation.mutate({ id, name: newName });
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") {
      setRenamingCategoryId(null);
      setRenameValue("");
    }
  }

  function startDelete(cat: UICategory) {
    setDeletingCategoryId(cat.id);
  }

  function confirmDelete() {
    const id = deletingCategoryId;
    if (!id) return;
    deleteMutation.mutate(id);
  }

  function startMove(cat: UICategory) {
    setMovingCategoryId(cat.id);
    setMoveTargetId("__root__");
  }

  function confirmMove() {
    const id = movingCategoryId;
    if (!id) return;
    const parent_id = moveTargetId === "__root__" ? null : moveTargetId;
    moveMutation.mutate({ id, parent_id });
  }

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    setDragOverId(event.over ? (event.over.id as string) : null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const draggedId = event.active.id as string;
    const targetId = event.over?.id as string | undefined;
    setDraggingId(null);
    setDragOverId(null);

    if (!targetId || targetId === draggedId) return;

    // Check that target is not a descendant of dragged (prevent cycles)
    const validTargets = getMoveTargets(draggedId);
    const isValidTarget = targetId === "__root__" || validTargets.some((c) => c.id === targetId);
    if (!isValidTarget) return;

    const parent_id = targetId === "__root__" ? null : targetId;
    moveMutation.mutate({ id: draggedId, parent_id });
  }

  const { data: suggestionsData } = useQuery({
    queryKey: suggestionKeys.pending(),
    queryFn: listSuggestions,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  const pendingSuggestions = suggestionsData?.meta.pending ?? 0;

  const visibleDomains = domainsExpanded ? domains : domains.slice(0, DOMAINS_COLLAPSED_COUNT);
  const hasMoreDomains = domains.length > DOMAINS_COLLAPSED_COUNT;
  const showViewAllLink = domains.length >= DOMAINS_PAGE_THRESHOLD;

  const visibleTags = tagsExpanded ? tags : tags.slice(0, TAGS_COLLAPSED_COUNT);
  const hasMoreTags = tags.length > TAGS_COLLAPSED_COUNT;

  // Categories valid as move targets (excludes the category itself and its descendants)
  function getMoveTargets(movingId: string): ApiCategory[] {
    const excluded = new Set<string>();
    function collectSubtree(id: string) {
      if (excluded.has(id)) return; // already visited — also breaks any data cycles
      excluded.add(id);
      flatApiCategories.forEach((c) => {
        if (c.parent_id === id) collectSubtree(c.id);
      });
    }
    collectSubtree(movingId);
    return flatApiCategories.filter((c) => !excluded.has(c.id));
  }

  const deletingCat = deletingCategoryId ? findApiCatById(deletingCategoryId) : null;
  const deletingCatHasBookmarks = (deletingCat?.bookmark_count ?? 0) > 0;

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2">
            <Flame className="h-6 w-6 text-primary shrink-0" />
            {!collapsed && (
              <div>
                <h1 className="font-semibold text-sm tracking-tight">Little Imp</h1>
                <p className="text-[10px] text-muted-foreground font-mono">{totalCount} bookmarks</p>
              </div>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent>
          {/* Categories */}
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center justify-between">
              <span className="flex items-center">
                <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                {!collapsed && "Categories"}
              </span>
              {!collapsed && (
                <button
                  onClick={openAddCategory}
                  className="ml-auto h-4 w-4 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  title="New category"
                >
                  <Plus className="h-3 w-3" />
                </button>
              )}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
              <SidebarMenu>
                {/* "Root" drop zone — drop here to make a category top-level */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onSelectCategory(null)}
                    className={cn(
                      !selectedCategory && "bg-accent text-accent-foreground",
                      draggingId && dragOverId === "__root__" && "ring-2 ring-primary/60 bg-primary/10"
                    )}
                    tooltip={collapsed ? `All (${totalCount})` : undefined}
                  >
                    {collapsed ? (
                      <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <>
                        <span className="text-xs">All</span>
                        <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5 font-mono">
                          {totalCount}
                        </Badge>
                      </>
                    )}
                  </SidebarMenuButton>
                  {/* Invisible droppable that covers the "All" item for root-level drops */}
                  {draggingId && !collapsed && <RootDropZone isOver={dragOverId === "__root__"} />}
                </SidebarMenuItem>
                {categories.map((cat) => (
                  <SidebarMenuItem key={cat.name}>
                    {renamingCategoryId === cat.id && !collapsed ? (
                      <div className="flex items-center gap-1 px-2 py-1">
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={handleRenameKeyDown}
                          onBlur={commitRename}
                          maxLength={100}
                          disabled={renameMutation.isPending}
                          className="flex-1 text-xs bg-transparent border-b border-border outline-none py-0.5"
                        />
                        <button
                          onClick={commitRename}
                          disabled={!renameValue.trim() || renameMutation.isPending}
                          className="h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                          title="Confirm"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => { setRenamingCategoryId(null); setRenameValue(""); }}
                          className="h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                          title="Cancel"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : cat.id ? (
                      <DraggableCategory
                        cat={cat}
                        collapsed={collapsed}
                        selectedCategory={selectedCategory}
                        onSelectCategory={onSelectCategory}
                        onStartRename={startRename}
                        onStartMove={startMove}
                        onStartDelete={startDelete}
                        isDragging={draggingId === cat.id}
                        isDropTarget={dragOverId === cat.id && draggingId !== cat.id}
                        isDraggingAny={!!draggingId}
                      />
                    ) : (
                      <SidebarMenuButton
                        onClick={() => onSelectCategory(selectedCategory === cat.name ? null : cat.name)}
                        className={cn(selectedCategory === cat.name && "bg-accent text-accent-foreground")}
                        tooltip={collapsed ? `${cat.name} (${cat.count})` : undefined}
                      >
                        {collapsed ? (
                          <span className="text-[10px] font-bold uppercase shrink-0">{cat.name.slice(0, 2)}</span>
                        ) : (
                          <>
                            <span className="text-xs truncate">{cat.name}</span>
                            <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5 font-mono">
                              {cat.count}
                            </Badge>
                          </>
                        )}
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                ))}
                {!collapsed && addingCategory && (
                  <SidebarMenuItem>
                    <div className="flex items-center gap-1 px-2 py-1">
                      <input
                        ref={newCategoryInputRef}
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyDown={handleNewCategoryKeyDown}
                        onBlur={() => {
                          if (!newCategoryName.trim()) {
                            setAddingCategory(false);
                          }
                        }}
                        placeholder="Category name…"
                        maxLength={100}
                        disabled={createCategoryMutation.isPending}
                        className="flex-1 text-xs bg-transparent border-b border-border outline-none placeholder:text-muted-foreground/60 py-0.5"
                      />
                      <button
                        onClick={handleCreateCategory}
                        disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
                        className="h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                        title="Create"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => { setAddingCategory(false); setNewCategoryName(""); }}
                        className="h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        title="Cancel"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
              <DragOverlay dropAnimation={null}>
                {draggingId && (() => {
                  const cat = categories.find((c) => c.id === draggingId);
                  if (!cat) return null;
                  return (
                    <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-accent text-accent-foreground text-xs shadow-lg border border-border opacity-90 w-40">
                      <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{cat.name}</span>
                    </div>
                  );
                })()}
              </DragOverlay>
              </DndContext>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Domains */}
          <SidebarGroup>
            <SidebarGroupLabel>
              <Globe className="h-3.5 w-3.5 mr-1.5" />
              {!collapsed && "Domains"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleDomains.map((d) => (
                  <SidebarMenuItem key={d.domain}>
                    <SidebarMenuButton
                      onClick={() => onSelectDomain(selectedDomain === d.domain ? null : d.domain)}
                      className={cn(selectedDomain === d.domain && "bg-accent text-accent-foreground")}
                      tooltip={collapsed ? `${d.domain} (${d.count})` : undefined}
                    >
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${d.domain}&sz=16`}
                        alt=""
                        className="h-3.5 w-3.5 shrink-0 rounded-sm"
                      />
                      {!collapsed && (
                        <>
                          <span className="text-xs truncate font-mono">{d.domain}</span>
                          <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5 font-mono">
                            {d.count}
                          </Badge>
                        </>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {!collapsed && hasMoreDomains && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setDomainsExpanded(!domainsExpanded)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {domainsExpanded ? (
                        <ChevronDown className="h-3 w-3 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3 w-3 shrink-0" />
                      )}
                      <span className="text-xs">
                        {domainsExpanded ? "Show less" : `Show ${domains.length - DOMAINS_COLLAPSED_COUNT} more`}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {!collapsed && showViewAllLink && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => navigate("/domains")}
                      className="text-primary hover:text-primary"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="text-xs font-medium">View all domains</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Timeline + Review Queue */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => navigate("/timeline")}
                    tooltip={collapsed ? "Timeline" : undefined}
                  >
                    <History className="h-3.5 w-3.5 shrink-0" />
                    {!collapsed && <span className="text-xs">Timeline</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => navigate("/archive")}
                    tooltip={collapsed ? "Archive" : undefined}
                  >
                    <Archive className="h-3.5 w-3.5 shrink-0" />
                    {!collapsed && <span className="text-xs">Archive</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => navigate("/review-queue")}
                    tooltip={collapsed ? `Review Queue${pendingSuggestions > 0 ? ` (${pendingSuggestions})` : ""}` : undefined}
                  >
                    <Bot className="h-3.5 w-3.5 shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="text-xs">Review Queue</span>
                        {pendingSuggestions > 0 && (
                          <Badge variant="destructive" className="ml-auto text-[10px] h-4 px-1.5 font-mono">
                            {pendingSuggestions}
                          </Badge>
                        )}
                      </>
                    )}
                    {collapsed && pendingSuggestions > 0 && (
                      <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Tags */}
          <SidebarGroup>
            <SidebarGroupLabel>
              <Hash className="h-3.5 w-3.5 mr-1.5" />
              {!collapsed && "Tags"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              {!collapsed ? (
                <div className="flex flex-wrap gap-1 px-2 pb-2">
                  {visibleTags.map((t) => (
                    <Badge
                      key={t.tag}
                      variant={selectedTag === t.tag ? "default" : "secondary"}
                      className="text-[10px] px-1.5 py-0 h-5 font-mono cursor-pointer transition-colors"
                      onClick={() => onSelectTag(selectedTag === t.tag ? null : t.tag)}
                    >
                      {t.tag}
                      <span className="ml-1 opacity-60">{t.count}</span>
                    </Badge>
                  ))}
                  {hasMoreTags && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 h-5 font-mono cursor-pointer transition-colors text-muted-foreground hover:text-foreground"
                      onClick={() => setTagsExpanded(!tagsExpanded)}
                    >
                      {tagsExpanded ? "Show less" : `+${tags.length - TAGS_COLLAPSED_COUNT} more`}
                    </Badge>
                  )}
                </div>
              ) : (
                <SidebarMenu>
                  {tags.slice(0, 3).map((t) => (
                    <SidebarMenuItem key={t.tag}>
                      <SidebarMenuButton
                        onClick={() => onSelectTag(selectedTag === t.tag ? null : t.tag)}
                        className={cn(selectedTag === t.tag && "bg-accent text-accent-foreground")}
                        tooltip={`#${t.tag} (${t.count})`}
                      >
                        <span className="text-[10px] font-mono shrink-0">#{t.tag.slice(0, 1)}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Settings */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => navigate("/settings")}
                    tooltip={collapsed ? "Settings" : undefined}
                  >
                    <Settings className="h-3.5 w-3.5 shrink-0" />
                    {!collapsed && <span className="text-xs">Settings</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deletingCategoryId} onOpenChange={(open) => !open && setDeletingCategoryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deletingCat?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingCatHasBookmarks
                ? `This category has bookmarks. They will become uncategorized after deletion.`
                : `This category will be permanently deleted.`}
              {" "}Any subcategories will be moved to this category's parent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move to dialog */}
      <AlertDialog open={!!movingCategoryId} onOpenChange={(open) => !open && setMovingCategoryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move "{findApiCatById(movingCategoryId ?? "")?.name}"</AlertDialogTitle>
            <AlertDialogDescription>
              Choose a new parent category. Select "Top level" to make it a root category.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 py-2">
            <Select value={moveTargetId} onValueChange={setMoveTargetId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select parent…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__root__">Top level (no parent)</SelectItem>
                {movingCategoryId &&
                  getMoveTargets(movingCategoryId).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMove} disabled={moveMutation.isPending}>
              Move
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
