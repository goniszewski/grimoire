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
	const { passwordHash, ...user } = userData;
	return user;
};

export const serializeTag = (tagData: TagDbo): Tag => {
	const owner = tagData.owner ? serializeUser(tagData.owner) : null;

	return { ...tagData, owner };
};

export const serializeCategory = (categoryData: CategoryDbo): Category => {
	const owner = categoryData.owner ? serializeUser(categoryData.owner) : undefined;
	const parent = categoryData.parent ? serializeCategory(categoryData.parent) : undefined;

	return {
		...categoryData,
		owner,
		parent
	};
};

export const serializeBookmark = ({ tags, ...bookmark }: BookmarkDbo): Bookmark => {
	const icon = getFileUrl(bookmark.icon?.relativePath);
	const mainImage = getFileUrl(bookmark.mainImage?.relativePath);
	const screenshot = getFileUrl(bookmark.screenshot?.relativePath);

	const category = bookmark.category ? serializeCategory(bookmark.category) : undefined;
	const owner = bookmark.owner ? serializeUser(bookmark.owner) : undefined;

	const serializedTags = tags?.map((tag) => serializeTag(tag.tag!));

	return {
		...bookmark,
		icon,
		mainImage,
		screenshot,
		category,
		owner,
		tags: serializedTags
	};
};

export const serializeBookmarkList = (bookmarks: BookmarkDbo[]): Bookmark[] =>
	structuredClone(bookmarks.map(serializeBookmark));

export const serializeFile = (fileData: FileDbo): File => {
	const owner = fileData.owner ? serializeUser(fileData.owner) : undefined;

	return {
		...fileData,
		owner
	};
};
