import { describe, expect, it } from 'vitest';

import { getFileUrl } from './get-file-url';

describe('getFileUrl', () => {
	it('should create a file url', () => {
		expect(getFileUrl('bookmarks', '123', 'test.jpg')).toContain(
			'/api/files/bookmarks/123/test.jpg'
		);
	});
});
