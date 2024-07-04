import {
    createTag, deleteTag, getTagByName, getTagsByUserId, updateTag
} from '$lib/database/repositories/Tag.repository';
import joi from 'joi';

import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';
import type { AddTagRequestBody, UpdateTagRequestBody } from '$lib/types/api/Tags.type';

export const GET: RequestHandler = async ({ locals }) => {
	const ownerId = locals.user?.id;

	if (!ownerId) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const tags = await getTagsByUserId(ownerId);
		return json({ tags }, { status: 200 });
	} catch (error: any) {
		return json({ success: false, error: error?.message }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const ownerId = locals.user?.id;

	if (!ownerId) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	const requestBody = (await request.json()) as AddTagRequestBody;

	const validationSchema = joi.object({
		name: joi.string().required()
	});

	const { error } = validationSchema.validate(requestBody);

	if (error) {
		return json({ success: false, error: error.message }, { status: 400 });
	}

	try {
		const existingTag = await getTagByName(requestBody.name, ownerId);

		if (existingTag) {
			return json({ success: false, error: 'Tag with this name already exists' }, { status: 403 });
		}

		const tag = await createTag(ownerId, requestBody);

		return json({ tag }, { status: 201 });
	} catch (error: any) {
		return json({ success: false, error: error?.message }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ locals, request }) => {
	const ownerId = locals.user?.id;

	if (!ownerId) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	const requestBody = (await request.json()) as UpdateTagRequestBody;

	const validationSchema = joi.object({
		id: joi.number().required(),
		name: joi.string().optional()
	});

	const { error } = validationSchema.validate(requestBody);

	if (error) {
		return json({ success: false, error: error.message }, { status: 400 });
	}

	const { id, ...updatedFields } = requestBody;

	try {
		const tag = await updateTag(id, ownerId, updatedFields);
		return json({ tag }, { status: 200 });
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
			return json({ success: false, error: 'Tag ID is required' }, { status: 400 });
		}

		await deleteTag(id, ownerId);

		return json({ success: true }, { status: 200 });
	} catch (error: any) {
		return json({ success: false, error: error?.message }, { status: 404 });
	}
};
