import type { Category } from './Category.type';
import type { Metadata } from './Metadata.type';
import type { Tag } from './Tag.type';
import type { User } from './User.type';

export type Bookmark = {
	id: number;
	url: string;
	domain: string;
	title: string;
	description: string | null;
	author: string | null;
	contentText: string | null;
	contentHtml: string | null;
	contentType: string | null;
	contentPublishedDate: string | null;
	note: string | null;
	mainImage: string | null;
	mainImageId: number | null;
	mainImageUrl: string | null;
	icon: string | null;
	iconUrl: string | null;
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

export type BookmarkEdit = Partial<Metadata> & {
	id: number;
	icon: string | null;
	url: string;
	title: string;
	category: string;
	selected: boolean;
	imported?: boolean;
	bookmarkTags?: {
		value: string;
		label: string;
		created?: boolean;
	}[];
};
