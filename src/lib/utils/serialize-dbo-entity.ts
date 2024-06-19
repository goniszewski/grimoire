import type { Bookmark } from '$lib/types/Bookmark.type';
import type { Category } from '$lib/types/Category.type';
import type { BookmarkDbo } from '$lib/types/dbo/BookmarkDbo.type';
import type { CategoryDbo } from '$lib/types/dbo/CategoryDbo.type';
import type { FileDbo } from '$lib/types/dbo/FileDbo.type';
import type { TagDbo } from '$lib/types/dbo/TagDbo.type';
import type { UserDbo } from '$lib/types/dbo/UserDbo.type';
import type { Tag } from '$lib/types/Tag.type';
import type { User } from '$lib/types/User.type';
import type { File } from '$lib/types/File.type';
import { getFileUrl } from './get-file-url';

export const serializeUser = (userData: UserDbo): User => {
	const user = userData;
	return user;
};

export const serializeTag = (tagData: TagDbo): Tag => {
	const owner = tagData.owner ? serializeUser(tagData.owner) : null;

	return { ...tagData, owner };
};

export const serializeCategory = (categoryData: CategoryDbo): Category => {
	const owner = categoryData.owner ? serializeUser(categoryData.owner) : null;
	const parent = categoryData.parent ? serializeCategory(categoryData.parent) : null;

	return {
		...categoryData,
		owner,
		parent
	};
};

export const serializeBookmark = (bookmark: BookmarkDbo): Bookmark => {
	const icon = getFileUrl(bookmark.icon?.relativePath);
	const mainImage = getFileUrl(bookmark.mainImage?.relativePath);
	const screenshot = getFileUrl(bookmark.screenshot?.relativePath);

	const category = bookmark.category ? serializeCategory(bookmark.category) : undefined;
	const owner = bookmark.owner ? serializeUser(bookmark.owner) : undefined;
	const tags = bookmark.tags ? bookmark.tags.map(serializeTag) : undefined;

	return {
		...bookmark,
		icon,
		mainImage,
		screenshot,
		category,
		owner,
		tags
	};
};

export const serializeBookmarkList = (bookmarks: BookmarkDbo[]): Bookmark[] =>
	structuredClone(bookmarks.map(serializeBookmark));

export const serializeFile = (fileData: FileDbo): File => {
	const owner = fileData.owner ? serializeUser(fileData.owner) : null;

	return {
		...fileData,
		owner
	};
};
