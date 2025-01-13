import type { Category } from './Category.type';
import type { Metadata } from './Metadata.type';
import type { Tag } from './Tag.type';
import type { User } from './User.type';

export type Bookmark = Metadata & {
	id: number;
	mainImage: string | null;
	mainImageId: number | null;
	icon: string | null;
	note: string | null;
	importance: number | null;
	flagged: null | Date;
	read: null | Date;
	archived: null | Date;
	category?: Category;
	tags?: Tag[];
	owner?: User;
	openedLast: null | Date;
	openedTimes: number;
	screenshotId: number | null;
	screenshot: string | null;
	created: Date;
	updated: Date;
};

export type BookmarkForIndex = Omit<Bookmark, 'mainImage' | 'icon' | 'screenshot' | 'category'> & {
	tags: Tag[];
	category: Omit<Category, 'parent' | 'owner'>;
};

export type BookmarkEdit = Metadata & {
	id: number;
	icon: string | null;
	url: string;
	title: string;
	category: {
		id?: number;
		name: string;
	};
	selected: boolean;
	importance: number | null;
	flagged: Date | null;
	note: string | null;
	imported?: boolean;
	bookmarkTags?: {
		value: string;
		label: string;
		created?: boolean;
	}[];
};
