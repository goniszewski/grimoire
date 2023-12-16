import { pb } from '$lib/pb.js';
import { createSlug } from '$lib/utils';
import joi from 'joi';

import { json } from '@sveltejs/kit';

import type { Category } from '$lib/types/Category.type';

const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/i;

export async function GET({ locals }) {
	const owner = locals.user?.id;

	if (!owner) {
		return json(
			{
				success: false,
				error: 'Unauthorized'
			},
			{
				status: 401
			}
		);
	}

	try {
		const categories = await pb.collection('categories').getFullList({
			filter: `owner="${owner}"`
		});

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
	const owner = locals.user?.id;

	if (!owner) {
		return json(
			{
				success: false,
				error: 'Unauthorized'
			},
			{
				status: 401
			}
		);
	}

	const requestBody = await request.json();

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
		const category = (await pb.collection('categories').create({
			name: requestBody.name,
			icon: requestBody.icon,
			description: requestBody.description,
			color: requestBody.color,
			parent: requestBody.parent,
			public: requestBody.public ? new Date() : null,
			slug: createSlug(requestBody.name),
			owner
		})) as Category;

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

export async function PATCH({ locals, request }) {
	const owner = locals.user?.id;

	if (!owner) {
		return json(
			{
				success: false,
				error: 'Unauthorized'
			},
			{
				status: 401
			}
		);
	}

	const { id, ...updatedFields } = await request.json();

	const validationSchema = joi.object({
		name: joi.string().optional(),
		icon: joi.string().allow(null).optional(),
		description: joi.string().allow('').optional(),
		color: joi.string().regex(HEX_COLOR_REGEX).allow('').optional(),
		parent: joi.string().allow(null).optional(),
		public: joi.boolean().optional(),
		archived: joi.boolean().optional()
	});

	const { error } = validationSchema.validate(updatedFields);

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
		const category = (await pb.collection('categories').update(id, updatedFields)) as Category;

		if (!category.id) {
			return json(
				{
					success: false,
					error: 'Category update failed'
				},
				{
					status: 400
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
