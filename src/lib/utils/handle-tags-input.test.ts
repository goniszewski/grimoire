import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prepareTags } from './handle-tags-input';

const tagIdStub = 123;

const existingTagsStub = [
	{
		id: '123',
		label: 'test',
		value: '123'
	},
	{
		label: 'test2',
		value: '456'
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

const dbInsertMock = vi.fn(() => ({
	values: vi.fn(() => ({
		returning: vi.fn(() => [{ id: tagIdStub }])
	}))
}));

const dbMock = {
	insert: dbInsertMock
};

describe('prepareTags', () => {
	beforeEach(() => {
		dbInsertMock.mockClear();
	});

	it('should create tags', async () => {
		const tags = await prepareTags(dbMock as any, createTagsStub, 1);

		expect(tags).toEqual([tagIdStub, tagIdStub]);
		expect(dbInsertMock).toHaveBeenCalledTimes(2);
		expect(dbInsertMock).toHaveBeenCalledWith(expect.anything());
		expect(dbInsertMock().values).toHaveBeenCalledWith({
			name: 'test3',
			slug: 'test3',
			ownerId: 1
		});
		expect(dbInsertMock().values).toHaveBeenCalledWith({
			name: 'test4',
			slug: 'test4',
			ownerId: 1
		});
	});

	it('should return existing tags', async () => {
		const tags = await prepareTags(dbMock as any, existingTagsStub, 1);

		expect(tags).toEqual([123, 456]);
		expect(dbInsertMock).not.toHaveBeenCalled();
	});

	it('should return existing and created tags', async () => {
		const tags = await prepareTags(dbMock as any, [...existingTagsStub, ...createTagsStub], 1);

		expect(tags).toEqual([123, 456, tagIdStub, tagIdStub]);
		expect(dbInsertMock).toHaveBeenCalledTimes(2);
		expect(dbInsertMock).toHaveBeenCalledWith(expect.anything());
		expect(dbInsertMock().values).toHaveBeenCalledWith({
			name: 'test3',
			slug: 'test3',
			ownerId: 1
		});
		expect(dbInsertMock().values).toHaveBeenCalledWith({
			name: 'test4',
			slug: 'test4',
			ownerId: 1
		});
	});
});
