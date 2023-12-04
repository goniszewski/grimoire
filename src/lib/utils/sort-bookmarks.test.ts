import { describe, expect, it } from 'vitest';

import { sortBookmarks } from './sort-bookmarks';

import type { Bookmark } from '$lib/types/Bookmark.type';
import type { Category } from '$lib/types/Category.type';
import type { User } from '$lib/types/User.type';

const bookmarksStub = [
	{
		id: '1',
		url: 'https://example.com',
		domain: 'example.com',
		title: 'A',
		description: 'A',
		author: 'A',
		content_text: 'A',
		content_html: 'A',
		content_type: 'A',
		content_published_date: new Date('2021-01-01'),
		note: 'A',
		main_image: 'A',
		main_image_url: 'A',
		icon: 'A',
		icon_url: 'A',
		importance: 0,
		flagged: null,
		read: null,
		archived: null,
		category: {} as Category,
		tags: [],
		owner: {} as User,
		opened_last: null,
		opened_times: 0,
		created: new Date('2021-01-01'),
		updated: new Date('2021-01-01')
	},
	{
		id: '2',
		url: 'https://example.com',
		domain: 'example.com',
		title: 'B',
		description: 'B',
		author: 'B',
		content_text: 'B',
		content_html: 'B',
		content_type: 'B',
		content_published_date: new Date('2021-01-02'),
		note: 'B',
		main_image: 'B',
		main_image_url: 'B',
		icon: 'B',
		icon_url: 'B',
		importance: 0,
		flagged: null,
		read: null,
		archived: null,
		category: {} as Category,
		tags: [],
		owner: {} as User,
		opened_last: null,
		opened_times: 0,
		created: new Date('2021-01-02'),
		updated: new Date('2021-01-02')
	},
	{
		id: '3',
		url: 'https://example.com',
		domain: 'example.com',
		title: 'C',
		description: 'C',
		author: 'C',
		content_text: 'C',
		content_html: 'C',
		content_type: 'C',
		content_published_date: new Date('2021-01-03'),
		note: 'C',
		main_image: 'C',
		main_image_url: 'C',
		icon: 'C',
		icon_url: 'C',
		importance: 0,
		flagged: null,
		read: null,
		archived: null,
		category: {} as Category,
		tags: [],
		owner: {} as User,
		opened_last: null,
		opened_times: 0,
		created: new Date('2021-01-03'),
		updated: new Date('2021-01-03')
	}
] as Bookmark[];

describe('sortBookmarks', () => {
	it('should sort bookmarks by created date', () => {
		expect(sortBookmarks(bookmarksStub, 'created_asc')).toEqual(bookmarksStub);
		expect(sortBookmarks(bookmarksStub, 'created_desc')).toEqual([...bookmarksStub].reverse());
	});

	it('should sort bookmarks by title', () => {
		expect(sortBookmarks(bookmarksStub, 'title_asc')).toEqual(bookmarksStub);
		expect(sortBookmarks(bookmarksStub, 'title_desc')).toEqual([...bookmarksStub].reverse());
	});
});
