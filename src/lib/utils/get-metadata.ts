import { convert } from 'html-to-text';
import sanitize from 'sanitize-html';
import urlMetadata from 'url-metadata';

import { extract, extractFromHtml } from '@extractus/article-extractor';

import type { Metadata } from '$lib/types/Metadata.type';

const getIconUrl = async (pageUrl: string, iconPath: string): Promise<string> => {
	if (!iconPath) return '';

	const baseUrl = new URL(pageUrl).origin.replace(/\/$/, '');
	iconPath = iconPath.split('?')[0].replace(/^\//, '');

	let fullIconUrl = iconPath.startsWith('http') ? iconPath : `${baseUrl}/${iconPath}`;

	try {
		const response = await fetch(fullIconUrl, { method: 'HEAD' });
		if (response.ok) {
			const contentType = response.headers.get('content-type');
			if (contentType && contentType.startsWith('image/')) {
				return fullIconUrl;
			}
		}
	} catch (error) {
		console.error('Error checking icon URL:', error);
	}

	return '';
};

const removeExtraEmptyLines = (html: string) => html.replace(/\n\s*\n/g, '\n');
const htmlToText = (html: string) => removeExtraEmptyLines(convert(html, { wordwrap: false }));
const sanitizeHtml = (html: string) => sanitize(html);

const articleExtractorScraper = async (html: string, url: string): Promise<Partial<Metadata>> => {
	let articleExtractorMetadata;

	if (html !== '') {
		articleExtractorMetadata = await extractFromHtml(html, url).catch((error) => {
			console.error('articleExtractorScraper.extractFromHtml', error);
			return null;
		});
	} else {
		articleExtractorMetadata = await extract(url).catch((error) => {
			console.error('articleExtractorScraper.extract', error);
			return null;
		});
	}

	return {
		url: articleExtractorMetadata?.url,
		title: articleExtractorMetadata?.title,
		description: articleExtractorMetadata?.description,
		author: articleExtractorMetadata?.author,
		mainImageUrl: articleExtractorMetadata?.image,
		contentHtml: articleExtractorMetadata?.content
			? sanitizeHtml(articleExtractorMetadata?.content)
			: '',
		contentPublishedDate: articleExtractorMetadata?.published
			? new Date(articleExtractorMetadata?.published)
			: null
	};
};

async function urlMetadataScraper(html: string, url: string): Promise<Partial<Metadata>> {
	try {
		const urlMetadataMetadata =
			html !== ''
				? await urlMetadata(null, {
						parseResponseObject: new Response(html, { headers: { 'content-type': 'text/html' } })
					})
				: await urlMetadata(url);

		const iconUrls = urlMetadataMetadata?.favicons
			?.map((favicon: { href: string; sizes?: string }) => {
				const isPng = favicon.href.endsWith('.png');
				const faviconSize = +(favicon.sizes?.split('x')?.[0] ?? '0');
				const isBestSize = faviconSize && (faviconSize <= 120 || faviconSize >= 64);
				return isPng && isBestSize ? favicon.href : null;
			})
			.filter(Boolean);

		const iconUrl = await getIconUrl(
			url,
			iconUrls?.[0] || urlMetadataMetadata?.favicons?.[0]?.href || ''
		);

		return {
			url: urlMetadataMetadata?.url || urlMetadataMetadata?.['og:url'],
			title: urlMetadataMetadata?.title || urlMetadataMetadata?.['og:title'],
			description: urlMetadataMetadata?.description || urlMetadataMetadata?.['og:description'],
			author: urlMetadataMetadata?.author || urlMetadataMetadata?.['twitter:creator'],
			mainImageUrl: urlMetadataMetadata?.image || urlMetadataMetadata?.['og:image'],
			iconUrl
		};
	} catch (error) {
		console.error('Error in urlMetadataScraper:', error);
		return { url };
	}
}

export async function getMetadata(url: string, providedHtml?: string): Promise<Metadata> {
	const html: string = providedHtml || (await fetch(url).then((res: Response) => res.text()));

	const urlMetadataMetadata = await urlMetadataScraper(html, url);
	const articleExtractorMetadata = await articleExtractorScraper(html, url);

	const firstParagraph = html?.match(/<p[^>]*>(.*?)<\/p>/)?.[1];
	const domain = new URL(url).hostname.replace('www.', '');
	const contentText = articleExtractorMetadata?.contentHtml
		? htmlToText(articleExtractorMetadata.contentHtml) || htmlToText(html)
		: '';

	return {
		url: urlMetadataMetadata?.url || articleExtractorMetadata?.url || url,
		domain,
		title: urlMetadataMetadata?.title || articleExtractorMetadata?.title || '',
		description:
			urlMetadataMetadata?.description ||
			articleExtractorMetadata?.description ||
			firstParagraph ||
			'',
		author: urlMetadataMetadata?.author || articleExtractorMetadata?.author || '',
		contentText,
		contentHtml: articleExtractorMetadata?.contentHtml || sanitizeHtml(html) || '',
		contentType: '',
		contentPublishedDate: null,
		mainImageUrl: urlMetadataMetadata?.mainImageUrl || articleExtractorMetadata?.mainImageUrl || '',
		iconUrl: urlMetadataMetadata?.iconUrl || ''
	};
}
