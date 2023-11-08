import type { Tag } from '../Tag.type';

export interface TagWithBookmarks extends Tag {
	bookmarks: string[];
}
