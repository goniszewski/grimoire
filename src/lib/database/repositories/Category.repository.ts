import { serializeCategory } from '$lib/utils/serialize-dbo-entity';
import { and, asc, count, desc, eq } from 'drizzle-orm';

import { db } from '../db';
import { categorySchema } from '../schema';
import { mapRelationsToWithStatements } from './common';

import type { Category } from '$lib/types/Category.type';
import type { CategoryDbo } from '$lib/types/dbo/CategoryDbo.type';

enum CategoryRelations {
	OWNER = 'owner',
	PARENT = 'parent'
}
const allCategoryRelations: CategoryRelations[] = Object.values(CategoryRelations);

export const getCategoryById = async (
	id: number,
	ownerId: number,
	relations: CategoryRelations[] = allCategoryRelations
): Promise<Category | null> => {
	const category = (await db.query.categorySchema.findFirst({
		where: and(eq(categorySchema.id, id), eq(categorySchema.ownerId, ownerId)),
		with: mapRelationsToWithStatements(relations)
	})) as CategoryDbo | undefined;

	return category ? serializeCategory(category) : null;
};

const orderKeys = {
	created: categorySchema.created,
	name: categorySchema.name,
	slug: categorySchema.slug
};

export const getCategoriesByUserId = async (
	userId: number,
	options?: {
		orderBy?: keyof typeof orderKeys;
		orderDirection?: 'asc' | 'desc';
		limit?: number;
		page?: number;
	},
	relations: CategoryRelations[] = allCategoryRelations
): Promise<Category[]> => {
	const categories = (await db.query.categorySchema.findMany({
		limit: options?.limit,
		offset: options?.page && options?.limit && (options.page - 1) * options.limit,
		orderBy:
			options?.orderBy &&
			(options.orderDirection === 'asc'
				? asc(orderKeys[options.orderBy])
				: desc(orderKeys[options.orderBy])),
		where: eq(categorySchema.ownerId, userId),
		with: mapRelationsToWithStatements(relations)
	})) as CategoryDbo[];

	return categories.map(serializeCategory);
};

export const createCategory = async (
	ownerId: number,
	categoryData: Omit<typeof categorySchema.$inferInsert, 'ownerId'>
): Promise<Category> => {
	const [category]: CategoryDbo[] = await db
		.insert(categorySchema)
		.values({ ...categoryData, ownerId })
		.returning();

	return serializeCategory(category);
};

export const updateCategory = async (
	id: number,
	ownerId: number,
	categoryData: Partial<typeof categorySchema.$inferInsert>
): Promise<Category> => {
	const [category]: CategoryDbo[] = await db
		.update(categorySchema)
		.set(categoryData)
		.where(and(eq(categorySchema.id, id), eq(categorySchema.ownerId, ownerId)))
		.returning();

	return serializeCategory(category);
};

export const deleteCategory = async (id: number, ownerId: number): Promise<void> => {
	await db
		.delete(categorySchema)
		.where(and(eq(categorySchema.id, id), eq(categorySchema.ownerId, ownerId)));
};

export const getCategoryCountForUser = async (userId: number): Promise<number> => {
	const [{ count: categoryCount }] = await db
		.select({ count: count(categorySchema.id) })
		.from(categorySchema)
		.where(eq(categorySchema.ownerId, userId));

	return categoryCount;
};

export const getInitialCategory = async (userId: number): Promise<Category | null> => {
	const category = (await db.query.categorySchema.findFirst({
		where: and(eq(categorySchema.ownerId, userId), eq(categorySchema.initial, true)),
		with: mapRelationsToWithStatements([CategoryRelations.OWNER])
	})) as CategoryDbo | undefined;

	return category ? serializeCategory(category) : null;
};
