import type { Category } from './Category.type';
import type { Tag } from './Tag.type';
import type { User } from './User.type';
import type { File } from './File.type';

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
	mainImage: File | null;
	mainImageId: number | null;
	mainImageUrl: string | null;
	icon: File | null;
	iconUrl: string | null;
	importance: number | null;
	flagged: null | Date;
	read: null | Date;
	archived: null | Date;
	category: Category;
	tags?: Tag[];
	owner?: User;
	openedLast: null | Date;
	openedTimes: number;
	screenshotId: number | null;
	screenshot: File | null;
	created: Date;
	updated: Date;
};

export type BookmarkForIndex = Omit<Bookmark, 'mainImage' | 'icon' | 'screenshot'> & {
	tags: Tag[];
};
