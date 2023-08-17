import type { Category } from './Category.interface';
import type { Tag } from './Tag.interface';
import type { User } from './User.interface';

export interface Bookmark {
	id: string;
	url: string;
	domain: string;
	title: string;
	description: string;
	author: string;
	content_text: string;
	content_html: string;
	content_type: string;
	content_published_date: Date | null;
	note: string;
	main_image: string;
	main_image_url: string;
	icon: string;
	icon_url: string;
	importance: number;
	flagged: Date;
	read: Date;
	archived: Date;
	category: Category;
	tags: Tag[];
	owner: User;
	opened_last: Date;
	opened_times: number;
	created: Date;
	updated: Date;
}
