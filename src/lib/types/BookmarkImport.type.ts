import type { Bookmark, BookmarkEdit } from './Bookmark.type';
import type { Category } from './Category.type';

export type ImportedBookmark = Pick<Bookmark, 'title' | 'url' | 'description'> & {
	categorySlug?: string;
	createdAt?: Date;
	icon?: string;
};
export type ImportedCategory = Pick<Category, 'name' | 'slug'> & {
	createdAt?: Date;
	parentSlug?: string;
};
export type ImportedTag = string;
export type ImportResult = {
	bookmarks: ImportedBookmark[];
	categories: ImportedCategory[];
	tags: ImportedTag[];
};

export type ImportProgress = {
    processed: number;
    total: number;
    successful: number;
    failed: number;
};

export type ImportExecutionResult = {
	total: number;
	successful: number;
	failed: number;
	results: Array<{
		success: boolean;
		bookmark: {
			id: number;
			url: string;
			title: string;
			category: string;
			success: boolean
		};
		error?: string;
	}>;
};
