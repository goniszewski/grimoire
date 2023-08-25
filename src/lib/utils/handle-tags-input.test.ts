import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const pbCreateArgsStub = {
    first: [{
        name: createTagsStub[0].label,
        slug: createTagsStub[0].value,
        owner: 'test'
    },
    {
        $cancelKey: createTagsStub[0].label
    }]
    ,
    second: [{
        name: createTagsStub[1].label,
        slug: createTagsStub[1].value,
        owner: 'test'
    },
    {
        $cancelKey: createTagsStub[1].label
    }]
}

const pbCreateMock = vi.fn(() => ({
    id: tagIdStub
}));

const pbCollectionMock = vi.fn(() =>  ({
        create: pbCreateMock
    })
    );

const pb = {
	collection: pbCollectionMock
};




describe('prepareTags', () => {
    beforeEach(() => {
        pbCreateMock.mockClear();
        pbCollectionMock.mockClear();
    });

	it('should create tags', async () => {
		const tags = await prepareTags(pb as any, createTagsStub, 'test');

		expect(tags).toEqual([tagIdStub, tagIdStub]);
        expect(pbCollectionMock).toHaveBeenCalledWith('tags');
        expect(pbCreateMock).toHaveBeenCalledWith(...pbCreateArgsStub.first);
        expect(pbCreateMock).toHaveBeenLastCalledWith(...pbCreateArgsStub.second);
        expect(pbCollectionMock).toHaveBeenCalledTimes(2);
	});

	it('should return existing tags', async () => {
		const tags = await prepareTags(pb as any, existingTagsStub, 'test');

		expect(tags).toEqual([existingTagsStub[0].value, existingTagsStub[1].value]);
        expect(pbCollectionMock).not.toHaveBeenCalled();
	});

	it('should return existing and created tags', async () => {
		const tags = await prepareTags(pb as any, [...existingTagsStub, ...createTagsStub], 'test');
        
		expect(tags).toEqual([
			existingTagsStub[0].value,
			existingTagsStub[1].value,
			tagIdStub,
			tagIdStub
		]);
        expect(pbCollectionMock).toHaveBeenCalledWith('tags');
        expect(pbCreateMock).toHaveBeenCalledWith(...pbCreateArgsStub.first);
        expect(pbCreateMock).toHaveBeenLastCalledWith(...pbCreateArgsStub.second);
        expect(pbCollectionMock).toHaveBeenCalledTimes(2);
	});
});
