import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listSuggestions, createCategory } from "@/lib/api";
import { suggestionKeys } from "@/hooks/use-suggestions";
import { bookmarkKeys } from "@/hooks/use-bookmarks";
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
import { Category, TagCount, DomainCount } from "@/types/bookmark";
import { FolderOpen, Tag, Clock, Flame, Hash, Globe, ChevronDown, ChevronRight, ExternalLink, History, Bot, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

const DOMAINS_COLLAPSED_COUNT = 5;
const DOMAINS_PAGE_THRESHOLD = 20;
const TAGS_COLLAPSED_COUNT = 8;

interface AppSidebarProps {
  categories: Category[];
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
  const qc = useQueryClient();

  const createCategoryMutation = useMutation({
    mutationFn: (name: string) => createCategory(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bookmarkKeys.categories });
      setAddingCategory(false);
      setNewCategoryName("");
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

  return (
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
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => onSelectCategory(null)}
                  className={cn(!selectedCategory && "bg-accent text-accent-foreground")}
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
              </SidebarMenuItem>
              {categories.map((cat) => (
                <SidebarMenuItem key={cat.name}>
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
      </SidebarContent>
    </Sidebar>
  );
}
