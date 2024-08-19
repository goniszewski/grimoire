import { convert } from 'html-to-text';
import sanitize from 'sanitize-html';
import urlMetadata from 'url-metadata';

import { extract, extractFromHtml } from '@extractus/article-extractor';

import type { Metadata } from '$lib/types/Metadata.type';

const getIconUrl = (pageUrl: string, iconPath: string): string => {
	const baseUrl = new URL(pageUrl).origin;
	iconPath = iconPath.split('?')[0];

	if (iconPath.startsWith('/')) {
		iconPath = `${baseUrl}${iconPath.replace('//', '/')}`;
	} else if (iconPath.startsWith('./')) {
		iconPath = `${baseUrl}${iconPath.replace('./', '/')}`;
	} else if (!iconPath.startsWith('http')) {
		iconPath = `${baseUrl}/${iconPath}`;
	}

	return iconPath || '';
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
	let urlMetadataMetadata: urlMetadata.Result;

	if (html !== '') {
		const response = new Response(html, {
			headers: {
				'content-type': 'text/html'
			}
		});
		urlMetadataMetadata = await urlMetadata(null, {
			parseResponseObject: response
		});
	} else {
		urlMetadataMetadata = await urlMetadata(url);
	}

	const iconUrls = urlMetadataMetadata?.favicons
		?.map((favicon: { rel: string; href: string; sizes: string }) => {
			const isPng = favicon.href.endsWith('.png');
			const faviconSize = +favicon.sizes?.split('x')?.[0] || 0;
			const isBestSize = faviconSize && (faviconSize <= 120 || faviconSize >= 64);

			if (isPng && isBestSize) {
				return favicon.href;
			}
		})
		.filter(Boolean);

	return {
		url: urlMetadataMetadata?.url || urlMetadataMetadata?.['og:url'],
		title: urlMetadataMetadata?.title || urlMetadataMetadata?.['og:title'],
		description: urlMetadataMetadata?.description || urlMetadataMetadata?.['og:description'],
		author: urlMetadataMetadata?.author || urlMetadataMetadata?.['twitter:creator'],
		mainImageUrl: urlMetadataMetadata?.image || urlMetadataMetadata?.['og:image'],
		iconUrl: getIconUrl(url, iconUrls[0] || urlMetadataMetadata?.favicons?.[0].href)
	};
}

export async function getMetadata(url: string, providedHtml?: string): Promise<Metadata> {
	const html: string = providedHtml || (await fetch(url).then((res) => res.text()));

	const urlMetadataMetadata = await urlMetadataScraper(html, url);
	const articleExtractorMetadata = await articleExtractorScraper(html, url);

	const firstParagraph = html?.match(/<p[^>]*>(.*?)<\/p>/)?.[1];
	const domain = new URL(url).hostname.replace('www.', '');
	const contentText = articleExtractorMetadata?.contentHtml
		? htmlToText(articleExtractorMetadata.contentHtml) || htmlToText(html)
		: '';

	return {
		url: urlMetadataMetadata?.url || articleExtractorMetadata?.url || '',
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
