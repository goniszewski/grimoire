import { authenticateUserApiRequest, pb, removePocketbaseFields } from '$lib/pb.js';
import { createSlug } from '$lib/utils/create-slug.js';
import joi from 'joi';

import { json } from '@sveltejs/kit';

import type { Category } from '$lib/types/Category.type';
import type {
	AddCategoryRequestBody,
	UpdateCategoryRequestBody
} from '$lib/types/api/Categories.type';

const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/i;

export async function GET({ locals, request }) {
	const { owner, error } = await authenticateUserApiRequest(locals.pb, request);

	if (error) {
		return error;
	}

	try {
		const records = await pb.collection('categories').getFullList<Category>({
			filter: `owner="${owner}"`
		});

		const categories = removePocketbaseFields(records);

		return json(
			{ categories },
			{
				status: 200
			}
		);
	} catch (error: any) {
		return json(
			{
				success: false,
				error: error?.message
			},
			{
				status: 500
			}
		);
	}
}

export async function POST({ locals, request }) {
	const { owner, error: authError } = await authenticateUserApiRequest(locals.pb, request);

	if (authError) {
		return authError;
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
		const existingCategory = await pb.collection('categories').getFullList({
			filter: `owner="${owner}" && name="${requestBody.name}"`,
			fields: 'id'
		});

		if (existingCategory[0]?.id) {
			return json(
				{
					success: false,
					error: 'Category with this name already exists'
				},
				{
					status: 403
				}
			);
		}

		if (requestBody.public) requestBody.public = new Date();

		const category = await pb.collection('categories').create<Category>({
			...requestBody,
			slug: createSlug(requestBody.name),
			owner
		});

		if (!category.id) {
			return json(
				{
					success: false,
					error: 'Category creation failed'
				},
				{
					status: 400
				}
			);
		}

		return json(
			{ category },
			{
				status: 201
			}
		);
	} catch (error: any) {
		return json(
			{
				success: false,
				error: error?.message
			},
			{
				status: 500
			}
		);
	}
}

export async function PATCH({ locals, request }) {
	const { owner, error: authError } = await authenticateUserApiRequest(locals.pb, request);

	if (authError) {
		return authError;
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

	if (updatedFields.name) {
		updatedFields.slug = createSlug(updatedFields.name);
	}

	if (updatedFields.public) {
		updatedFields.public = new Date();
	}

	if (updatedFields.archived) {
		updatedFields.archived = new Date();
	}

	try {
		const currentCategory = await pb.collection('categories').getOne(id);

		if (!currentCategory || currentCategory.owner !== owner) {
			return json(
				{
					success: false,
					error: 'Category not found'
				},
				{
					status: 404
				}
			);
		}

		const category = (await pb.collection('categories').update(id, updatedFields)) as Category;

		if (!category.id) {
			return json(
				{
					success: false,
					error: 'Category update failed'
				},
				{
					status: 500
				}
			);
		}

		return json(
			{ category },
			{
				status: 200
			}
		);
	} catch (error: any) {
		return json(
			{
				success: false,
				error: error?.message
			},
			{
				status: 500
			}
		);
	}
}
