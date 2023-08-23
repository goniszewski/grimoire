import { describe, expect, it, vi } from 'vitest';

import { prepareTags } from './handle-tags-input';

const tagIdStub = '123';

const existingTagsStub = [
	{
		id: '123',
		label: 'test',
		value: 'testValue'
	},
	{
		label: 'test2',
		value: 'test2Value'
	}
];

const createTagsStub = [
	{
		label: 'test3',
		value: 'test3'
	},
	{
		label: 'test4',
		value: 'test4'
	}
];

const pb = {
	collection: () => ({
		create: () => ({ id: tagIdStub })
	})
};

describe('prepareTags', () => {
	it('should create tags', async () => {
		const tags = await prepareTags(pb as any, createTagsStub, 'test');
		expect(tags).toEqual([tagIdStub, tagIdStub]);
	});

	it('should return existing tags', async () => {
		const tags = await prepareTags(pb as any, existingTagsStub, 'test');
		expect(tags).toEqual([existingTagsStub[0].value, existingTagsStub[1].value]);
	});

	it('should return existing and created tags', async () => {
		const tags = await prepareTags(pb as any, [...existingTagsStub, ...createTagsStub], 'test');
		expect(tags).toEqual([
			existingTagsStub[0].value,
			existingTagsStub[1].value,
			tagIdStub,
			tagIdStub
		]);
	});
});
