import type { Bookmark } from '$lib/types/Bookmark.type';

export interface CreateBookmarkDto
	extends Pick<
		Bookmark,
		| 'url'
		| 'domain'
		| 'title'
		| 'description'
		| 'author'
		| 'content_html'
		| 'content_text'
		| 'content_type'
		| 'note'
		| 'main_image'
		| 'main_image_url'
		| 'icon'
		| 'icon_url'
		| 'importance'
		| 'flagged'
		| 'read'
		| 'category'
		| 'tags'
		| 'owner'
	> {}
