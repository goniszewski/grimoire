export type AddBookmarkRequestBody = {
	url: string;
	title: string;
	description?: string;
	author?: string;
	content_text?: string;
	content_html?: string;
	content_type?: string;
	content_published_date?: Date | null;
	note?: string;
	main_image_url?: string;
	icon_url?: string;
	importance?: number;
	flagged?: boolean;
	category: string;
	tags?: string[];
};

export type UpdateBookmarkRequestBody = AddBookmarkRequestBody & {
	id: string;
};
