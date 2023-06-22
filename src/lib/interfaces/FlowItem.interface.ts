import type { Bookmark } from "./Bookmark.interface";
import type { Flow } from "./Flow.interface";

export interface FlowItem {
    id: string;
    flow: Flow;
    item: Bookmark;
    note: string;
    icon: string;
    position: number;
    pinned?: Date;
    created: Date;
    updated: Date;
    removed?: Date;
}