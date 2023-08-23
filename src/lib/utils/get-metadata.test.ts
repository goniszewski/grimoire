import { describe, expect, it } from 'vitest';

import { getMetadata } from './get-metadata';

describe('getMetadata', () => {
	it('should return empty metadata from exam[le.com', async () => {
		const metadata = await getMetadata('https://example.com');

		expect(metadata).toMatchObject({
			url: 'https://example.com',
			title: 'Example Domain',
			description: '',
			author: '',
			content_html: '',
			content_published_date: '',
			content_text: '',
			content_type: '',
			domain: 'example.com',
			icon: '',
			icon_url: '',
			main_image: '',
			main_image_url: ''
		});
	});
});
