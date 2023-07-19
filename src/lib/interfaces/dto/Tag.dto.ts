import type { Tag } from '../Tag.interface';

export interface TagWithBookmarks extends Tag {
	bookmarks: string[];
}
