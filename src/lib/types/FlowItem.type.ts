import type { Bookmark } from './Bookmark.type';
import type { Flow } from './Flow.type';

export type FlowItem = {
	id: string;
	flow: Flow;
	item: Bookmark;
	note: string;
	icon: string;
	position: number;
	created: Date;
	updated: Date;
	pinned?: Date;
	removed?: Date;
};
