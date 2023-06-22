import type { CreateBookmarkDto } from './dto/create-bookmark.dto';
import type { UpdateBookmarkDto } from './dto/update-bookmark.dto';
import type PocketBase from 'pocketbase';

export class BookmarkService {
	constructor(private backend: PocketBase) {}

	createBookmark(data: CreateBookmarkDto, owner: string) {
		const domain = new URL(data.url).hostname;

		const bookmarkData = {
			url: data.url,
			domain,
			title: data.title,
			description: data.description,
			author: data.author,
			content_html: data.content_html,
			content_text: data.content_text,
			content_type: data.content_type,
			note: data.note,
			main_image: data.main_image,
			main_image_url: data.main_image_url,
			icon: data.icon,
			icon_url: data.icon_url,
			importance: data.importance,
			flagged: data.flagged,
			read: data.read,
			category: data.category,
			tags: data.tags,
			opened_last: data.read?.toISOString(),
			opened_count: 0,
			owner
		};

		return this.backend.collection('bookmarks').create(bookmarkData);
	}
	async updateBookmark(id: string, data: Partial<UpdateBookmarkDto>) {
		return this.backend.collection('bookmarks').update(id, data);
	}

	async getBookmarkById(id: string) {
		return this.backend.collection('bookmarks').getOne(id, {
			expand: 'category.name,category.archived,category.public,tags.name'
		});
	}
	async getBookmarkByUrl(url: string, owner: string) {
		return this.backend
			.collection('bookmarks')
			.getFirstListItem(`url="${url}" AND owner="${owner}"`, {
				expand: 'category.name,category.archived,category.public,tags.name'
			});
	}

	async getBookmarksAll(owner: string, page: number = 1, limit: number = 100) {
		return this.backend.collection('bookmarks').getList(page, limit, {
			filter: `owner="${owner}"`,
			sort: 'category.archived,archived,-flagged,-importance,-added',
			expand: 'category.name,category.archived,category.public,tags.name'
		});
	}

	async getBookmarksByCategory(
		owner: string,
		category: string,
		page: number = 1,
		limit: number = 50
	) {
		return this.backend.collection('bookmarks').getList(page, limit, {
			filter: `owner="${owner}" AND category="${category}"`,
			sort: 'category.archived,archived,-flagged,-importance,-added',
			expand: 'category.name,category.archived,category.public,tags.name'
		});
	}

	async getBookmarksByTags(owner: string, tags: string[], page: number = 1, limit: number = 50) {
		return this.backend.collection('bookmarks').getList(page, limit, {
			filter: `owner="${owner}" AND tags IN (${tags.map((tag) => `"${tag}"`).join(', ')})`,
			sort: 'category.archived,archived,-flagged,-importance,-added',
			expand: 'category.name,category.archived,category.public,tags.name'
		});
	}

	async getBookmarksByDomain(owner: string, domain: string, page: number = 1, limit: number = 50) {
		return this.backend.collection('bookmarks').getList(page, limit, {
			filter: `owner="${owner}" AND domain="${domain}"`,
			sort: 'category.archived,archived,-flagged,-importance,-added',
			expand: 'category.name,category.archived,category.public,tags.name'
		});
	}

	async getBookmarksFlagged(owner: string, page: number = 1, limit: number = 50) {
		return this.backend.collection('bookmarks').getList(page, limit, {
			filter: `owner="${owner}" AND flagged!=null`,
			sort: 'archived,-importance,-added',
			expand: 'category.name,category.archived,category.public,tags.name'
		});
	}

	async getBookmarksUnread(owner: string, page: number = 1, limit: number = 50) {
		return this.backend.collection('bookmarks').getList(page, limit, {
			filter: `owner="${owner}" AND read=null`,
			sort: 'category.archived,archived,-flagged,-importance,-added',
			expand: 'category.name,category.archived,category.public,tags.name'
		});
	}

	async getBookmarksRead(owner: string, page: number = 1, limit: number = 50) {
		return this.backend.collection('bookmarks').getList(page, limit, {
			filter: `owner="${owner}" AND read!=null`,
			sort: 'category.archived,archived,-flagged,-importance,-added',
			expand: 'category.name,category.archived,category.public,tags.name'
		});
	}

	async getBookmarksArchived(owner: string, page: number = 1, limit: number = 50) {
		return this.backend.collection('bookmarks').getList(page, limit, {
			filter: `owner="${owner}" AND archived!=null`,
			sort: '-flagged,-importance,-added',
			expand: 'category.name,category.archived,category.public,tags.name'
		});
	}

	async getBookmarksWithAtLeastImportance(
		owner: string,
		importance: number,
		page: number = 1,
		limit: number = 50
	) {
		return this.backend.collection('bookmarks').getList(page, limit, {
			filter: `owner="${owner}" AND importance>=${importance}`,
			sort: 'category.archived,archived,-flagged,-importance,-added',
			expand: 'category.name,category.archived,category.public,tags.name'
		});
	}

	async getBookmarksByTopTenPopularity(owner: string, category?: string) {
		return this.backend.collection('bookmarks').getList(1, 10, {
			filter: `owner="${owner}"${category ? ` AND category="${category}"` : ''}}`,
			sort: 'category.archived,archived,-opened_count',
			expand: 'category.name,category.archived,category.public,tags.name'
		});
	}

	async getBookmarksWithoutMetadata(owner: string, page: number = 1, limit: number = 50) {
		return this.backend.collection('bookmarks').getList(page, limit, {
			filter: `owner="${owner}" AND (title=null OR description=null OR author=null OR content_html=null OR content_text=null OR content_type=null OR main_image=null OR main_image_url=null OR icon=null OR icon_url=null)`,
			sort: '-added'
		});
	}

	async getBookmarksBySearch(owner: string, search: string, page: number = 1, limit: number = 50) {
		return this.backend.collection('bookmarks').getList(page, limit, {
			filter: `owner="${owner}" AND (title LIKE "%${search}%" OR description LIKE "%${search}%" OR content_text LIKE "%${search}%"
                OR domain LIKE "%${search}%" OR author LIKE "%${search}%" OR category.name LIKE "%${search}%" OR
                 tags.name LIKE "%${search}%"
            )`,
			sort: 'category.archived,archived,-flagged,-importance,-added',
			expand: 'category.name,category.archived,category.public,tags.name'
		});
	}

	async getBookmarksBySearchInTags(
		owner: string,
		search: string,
		page: number = 1,
		limit: number = 50
	) {
		return this.backend.collection('bookmarks').getList(page, limit, {
			filter: `owner="${owner}" AND tags LIKE "%${search}%"`,
			sort: 'category.archived,archived,-flagged,-importance,-added'
		});
	}

	async markBookmarkAsArchived(id: string) {
		return this.backend.collection('bookmarks').update(id, { archived: new Date() });
	}

	async markBookmarkAsNotArchived(id: string) {
		return this.backend.collection('bookmarks').update(id, { archived: null });
	}

	async markBookmarkAsFlagged(id: string) {
		return this.backend.collection('bookmarks').update(id, { flagged: new Date() });
	}

	async markBookmarkAsNotFlagged(id: string) {
		return this.backend.collection('bookmarks').update(id, { flagged: null });
	}

	async markBookmarkAsRead(id: string) {
		return this.backend.collection('bookmarks').update(id, { read: new Date() });
	}

	async markBookmarkAsNotRead(id: string) {
		return this.backend.collection('bookmarks').update(id, { read: null });
	}

	async incrementBookmarkOpenedCount(id: string) {
		const bookmark = await this.backend.collection('bookmarks').getOne(id);

		return this.backend
			.collection('bookmarks')
			.update(id, { opened_count: bookmark.opened_count + 1 });
	}

	async markBookmarkAsUnflagged(id: string) {
		return this.backend.collection('bookmarks').update(id, { flagged: null });
	}

	async countBookmarksByCategory(owner: string, category: string) {
		return this.backend
			.collection('bookmarks')
			.getList(1, 1, {
				filter: `owner="${owner}" AND category="${category}"`,
				fields: 'id'
			})
			.then((bookmarks) => bookmarks.totalPages);
	}

	async countBookmarksByTag(owner: string, tag: string) {
		return this.backend
			.collection('bookmarks')
			.getList(1, 1, {
				filter: `owner="${owner}" AND tags IN ("${tag}")`,
				fields: 'id'
			})
			.then((bookmarks) => bookmarks.totalPages);
	}

	async countBookmarks(owner: string) {
		return this.backend
			.collection('bookmarks')
			.getList(1, 1, {
				filter: `owner="${owner}"`,
				fields: 'id'
			})
			.then((bookmarks) => bookmarks.totalPages);
	}

	async countBookmarksByAllCategories(owner: string) {
		const bookmarksWithCategories = await this.backend.collection('bookmarks').getFullList({
			filter: `owner="${owner}"`,
			expand: 'category.name',
			fields: 'category.name'
		});

		const categories = bookmarksWithCategories.map((bookmark) => bookmark.category.name);

		return categories.reduce((acc, category) => {
			acc[category] = (acc[category] || 0) + 1;
			return acc;
		}, {});
	}
}
