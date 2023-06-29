import type { Bookmark } from '../Bookmark.interface';
import type { Category } from '../Category.interface';
import type { Tag } from '../Tag.interface';

export interface BookmarkDto extends Bookmark {
	expand?: Partial<{
		category: Category;
		tags: Tag[];
	}>;
}
