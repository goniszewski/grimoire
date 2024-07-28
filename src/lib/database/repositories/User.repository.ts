import { defaultUser } from '$lib/config';
import { serializeCategory, serializeTag, serializeUser } from '$lib/utils/serialize-dbo-entity';
import { asc, count, desc, eq } from 'drizzle-orm';

import { db } from '../db';
import { categorySchema, tagSchema, userSchema } from '../schema';
import { mapRelationsToWithStatements } from './common';

import type { User } from '$lib/types/User.type';
import type { UserDbo } from '$lib/types/dbo/UserDbo.type';
import type { UserSettings } from '$lib/types/UserSettings.type';
import type { Category } from '$lib/types/Category.type';
import type { Tag } from '$lib/types/Tag.type';
enum UserRelations {
	FILES = 'files',
	BOOKMARKS = 'bookmarks',
	CATEGORIES = 'categories',
	TAGS = 'tags'
}
const allUserRelations: UserRelations[] = Object.values(UserRelations);

export const getUserById = async (
	id: number,
	relations: UserRelations[] = allUserRelations
): Promise<User | null> => {
	const user = await db.query.userSchema.findFirst({
		where: eq(userSchema.id, id),
		with: mapRelationsToWithStatements(relations)
	});

	return user ? serializeUser(user) : null;
};

export const getUserByUsername = async (
	username: string,
	relations: UserRelations[] = allUserRelations
): Promise<User | null> => {
	const user = await db.query.userSchema.findFirst({
		where: eq(userSchema.username, username),
		with: mapRelationsToWithStatements(relations)
	});

	return user ? serializeUser(user) : null;
};

export const getUserByEmail = async (
	email: string,
	relations: UserRelations[] = allUserRelations
): Promise<User | null> => {
	const user = await db.query.userSchema.findFirst({
		where: eq(userSchema.email, email),
		with: mapRelationsToWithStatements(relations)
	});

	return user ? serializeUser(user) : null;
};

export const createUser = async (userData: typeof userSchema.$inferInsert): Promise<User> => {
	const [user]: UserDbo[] = await db
		.insert(userSchema)
		.values({ ...defaultUser, ...userData })
		.returning();

	return serializeUser(user);
};

export const updateUser = async (
	id: number,
	userData: Partial<typeof userSchema.$inferInsert>
): Promise<User> => {
	const [user]: UserDbo[] = await db
		.update(userSchema)
		.set({ ...userData, updated: new Date() })
		.where(eq(userSchema.id, id))
		.returning();

	return serializeUser(user);
};

export const getUserSettings = async (id: number): Promise<UserSettings> => {
	const [{ settings }] = await db.query.userSchema.findMany({
		where: eq(userSchema.id, id)
	});

	return settings;
};

export const updateUserSettings = async (
	id: number,
	settings: Partial<UserSettings>
): Promise<User> => {
	const existingUserSettings = await getUserSettings(id);

	const updatedUserSettings = {
		...existingUserSettings,
		...settings
	};
	return await updateUser(id, { settings: updatedUserSettings });
};

export const updateUserPassword = async (id: number, passwordHash: string): Promise<User> => {
	return await updateUser(id, { passwordHash });
};

export const deleteUser = async (id: number): Promise<void> => {
	await db.delete(userSchema).where(eq(userSchema.id, id));
};

export const getUserCount = async (): Promise<number> => {
	const [{ count: userCount }] = await db.select({ count: count(userSchema.id) }).from(userSchema);

	return userCount;
};

export const fetchUserCategoryAndTags = async (
	id: number
): Promise<{ categories: Category[]; tags: Tag[] }> => {
	const [{ categories, tags }] = await db.query.userSchema.findMany({
		where: eq(userSchema.id, id),
		with: {
			categories: {
				orderBy: desc(categorySchema.created),
				with: {
					parent: true
				}
			},
			tags: { orderBy: asc(tagSchema.name) }
		}
	});

	return { categories: categories.map(serializeCategory), tags: tags.map(serializeTag) };
};

export const getUsersForAdminPanel = async () => {
	const users = await db.query.userSchema.findMany({
		orderBy: desc(userSchema.created),
		columns: {
			id: true,
			username: true,
			email: true,
			created: true,
			disabled: true
		}
	});

	return users;
};

export const isUserDisabled = async (id: number): Promise<boolean> => {
	const [{ disabled }] = await db.query.userSchema.findMany({
		where: eq(userSchema.id, id)
	});
	return disabled ? true : false;
};
export const disableUser = async (id: number): Promise<User> => {
	return await updateUser(id, { disabled: new Date() });
};
