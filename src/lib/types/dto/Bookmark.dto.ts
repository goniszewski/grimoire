import type { Bookmark } from '../Bookmark.type';
import type { Category } from '../Category.type';
import type { Tag } from '../Tag.type';

export type BookmarkDto = Bookmark & {
	expand?: {
		category: Category;
		tags: Tag[];
	};
};
