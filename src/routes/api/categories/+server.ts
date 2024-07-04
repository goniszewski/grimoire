import {
    createCategory, deleteCategory, getCategoriesByUserId, getCategoryById, updateCategory
} from '$lib/database/repositories/Category.repository';
import { createSlug } from '$lib/utils/create-slug.js';
import joi from 'joi';

import { json } from '@sveltejs/kit';

import type {
	AddCategoryRequestBody,
	UpdateCategoryRequestBody
} from '$lib/types/api/Categories.type';
import type { RequestHandler } from './$types';
const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/i;

export const GET: RequestHandler = async ({ locals }) => {
	const ownerId = locals.user?.id;

	if (!ownerId) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const categories = await getCategoriesByUserId(ownerId);
		return json({ categories }, { status: 200 });
	} catch (error: any) {
		return json({ success: false, error: error?.message }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const ownerId = locals.user?.id;

	if (!ownerId) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	const requestBody = (await request.json()) as AddCategoryRequestBody;

	const validationSchema = joi.object({
		name: joi.string().required(),
		icon: joi.string().allow(null).optional(),
		description: joi.string().allow('').optional(),
		color: joi.string().allow('').optional(),
		parent: joi.string().allow(null).optional(),
		public: joi.boolean().optional()
	});

	const { error } = validationSchema.validate(requestBody);

	if (error) {
		return json(
			{
				success: false,
				error: error.message
			},
			{
				status: 400
			}
		);
	}

	try {
		const category = await createCategory(ownerId, {
			...requestBody,
			slug: createSlug(requestBody.name),
			public: requestBody.public ? new Date() : null
		});

		return json({ category }, { status: 201 });
	} catch (error: any) {
		return json({ success: false, error: error?.message }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ locals, request }) => {
	const ownerId = locals.user?.id;

	if (!ownerId) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	const requestBody = (await request.json()) as UpdateCategoryRequestBody;

	const validationSchema = joi.object({
		id: joi.string().required(),
		name: joi.string().optional(),
		icon: joi.string().allow(null).optional(),
		description: joi.string().allow('').optional(),
		color: joi.string().regex(HEX_COLOR_REGEX).allow('').optional(),
		parent: joi.string().allow(null).optional(),
		public: joi.boolean().optional(),
		archived: joi.boolean().optional()
	});

	const { error } = validationSchema.validate(requestBody);

	if (error) {
		return json(
			{
				success: false,
				error: error.message
			},
			{
				status: 400
			}
		);
	}

	const { id, ...updatedFields } = requestBody;

	try {
		const currentCategory = await getCategoryById(id, ownerId);

		if (!currentCategory) {
			return json({ success: false, error: 'Category not found' }, { status: 404 });
		}

		const category = await updateCategory(id, ownerId, {
			...updatedFields,
			slug: updatedFields.name ? createSlug(updatedFields.name) : undefined,
			public: updatedFields.public ? new Date() : null,
			archived: updatedFields.archived ? new Date() : null
		});

		return json({ category }, { status: 200 });
	} catch (error: any) {
		return json({ success: false, error: error?.message }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ locals, url }) => {
	const ownerId = locals.user?.id;

	if (!ownerId) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const id = parseInt(url.searchParams.get('id') || '', 10);

		if (!id) {
			return json({ success: false, error: 'Category ID is required' }, { status: 400 });
		}

		await deleteCategory(id, ownerId);

		return json({ success: true }, { status: 200 });
	} catch (error: any) {
		return json({ success: false, error: error?.message }, { status: 404 });
	}
};
