import { describe, expect, it } from 'vitest';

import { getMetadata } from './get-metadata';

describe('getMetadata', () => {
        it('should extract metadata from example.com html', async () => {
                const html = `<!doctype html><html><head><title>Example Domain</title></head><body><div><h1>Example Domain</h1><p>This domain is for use in illustrative examples in documents.</p></div></body></html>`;

                const metadata = await getMetadata('https://example.com', html);

                expect(metadata).toMatchObject({
                        url: 'https://example.com',
                        title: 'Example Domain',
                        domain: 'example.com'
                });
        });
});
