import type { CategoryNodeDto, SettingsDto, SuggestionDto, TimelinePageDto } from "../../../daemon/src/api/types";
import {
  DEMO_BOOKMARKS,
  DEMO_CATEGORIES,
  DEMO_SETTINGS,
  DEMO_SUGGESTIONS,
  DEMO_TIMELINE,
  type DemoBookmark,
} from "./fixtures";

export interface DemoState {
  bookmarks: MutableDemoBookmark[];
  categories: MutableCategoryNode[];
  settings: SettingsDto;
  timeline: TimelinePageDto["data"];
  suggestions: MutableSuggestion[];
}

export type MutableDemoBookmark = { -readonly [K in keyof DemoBookmark]: DemoBookmark[K] };
export type MutableCategoryNode = {
  -readonly [K in keyof CategoryNodeDto]: K extends "children" ? MutableCategoryNode[] : CategoryNodeDto[K];
};
export type MutableSuggestion = { -readonly [K in keyof SuggestionDto]: SuggestionDto[K] };

let nextSessionBookmarkNumber = DEMO_BOOKMARKS.length + 1;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function activeBookmarks(state: Pick<DemoState, "bookmarks">): MutableDemoBookmark[] {
  return state.bookmarks.filter((bookmark) => bookmark.is_archived === 0 && bookmark.is_trashed === 0);
}

function countCategory(bookmarks: MutableDemoBookmark[], categoryId: string): number {
  return bookmarks.filter((bookmark) => bookmark.category_id === categoryId).length;
}

function updateCategoryCounts(categories: MutableCategoryNode[], bookmarks: MutableDemoBookmark[]): MutableCategoryNode[] {
  return categories.map((category) => ({
    ...category,
    bookmark_count: countCategory(bookmarks, category.id),
    children: updateCategoryCounts(category.children, bookmarks),
  }));
}

export function createDemoState(): DemoState {
  nextSessionBookmarkNumber = DEMO_BOOKMARKS.length + 1;
  const bookmarks = clone([...DEMO_BOOKMARKS]) as MutableDemoBookmark[];
  const categories = clone(DEMO_CATEGORIES) as unknown as MutableCategoryNode[];
  return {
    bookmarks,
    categories: updateCategoryCounts(categories, activeBookmarks({ bookmarks })),
    settings: clone(DEMO_SETTINGS),
    timeline: clone(DEMO_TIMELINE) as TimelinePageDto["data"],
    suggestions: clone(DEMO_SUGGESTIONS) as MutableSuggestion[],
  };
}

export function nextSessionBookmarkId(): string {
  const id = `demo-session-${nextSessionBookmarkNumber}`;
  nextSessionBookmarkNumber += 1;
  return id;
}

let state = createDemoState();

export function getDemoState(): DemoState {
  return state;
}

export function resetDemoState(): DemoState {
  state = createDemoState();
  return state;
}

export function refreshCategoryCounts(): void {
  state.categories = updateCategoryCounts(state.categories, activeBookmarks(state));
}

export function flattenCategories(categories: MutableCategoryNode[] = state.categories): MutableCategoryNode[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.children)]);
}

export function bookmarkResponse(bookmark: MutableDemoBookmark): Omit<DemoBookmark, "content"> {
  const { content: _content, ...summary } = bookmark;
  return summary;
}

export function detailResponse(bookmark: MutableDemoBookmark): MutableDemoBookmark {
  return clone(bookmark);
}
