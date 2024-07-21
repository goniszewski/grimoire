import { convert } from 'html-to-text';
import sanitize from 'sanitize-html';
import urlMetadata from 'url-metadata';

import { extract, extractFromHtml } from '@extractus/article-extractor';

import type { Metadata } from '$lib/types/Metadata.type';

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

const faviconScraper = async (html: string, url: string): Promise<Partial<Metadata>> => {
	const getFaviconElementsRegex =
		/<link[^>]*rel=["'](?:icon|shortcut icon|apple-touch-icon-precomposed|apple-touch-icon|mask-icon|fluid-icon|manifest)["'][^>]*>/gim;
	const getUrlRegex = /href="([^"]*)"/;
	const baseUrl = new URL(url).origin;
	const matchedElements = html.match(getFaviconElementsRegex);

	const favicon = matchedElements?.reduce((acc, element) => {
		if (acc) return acc;

		const hrefMatch = element.match(getUrlRegex);
		if (!hrefMatch) return '';

		let faviconUrl = hrefMatch[1];

		if (faviconUrl.split('?')[0]) {
			faviconUrl = '';
		} else if (faviconUrl.startsWith('/')) {
			faviconUrl = `${baseUrl}${faviconUrl.replace('//', '/')}`;
		} else if (faviconUrl.startsWith('./')) {
			faviconUrl = `${baseUrl}${faviconUrl.replace('./', '/')}`;
		} else if (!faviconUrl.startsWith('http')) {
			faviconUrl = `${baseUrl}/${faviconUrl}`;
		}

		return faviconUrl;
	}, '');

	return {
		iconUrl: favicon || ''
	};
};

const removeExtraEmptyLines = (html: string) => html.replace(/\n\s*\n/g, '\n');

const htmlToText = (html: string) => removeExtraEmptyLines(convert(html, { wordwrap: false }));
const sanitizeHtml = (html: string) => sanitize(html);

export async function getMetadata(url: string) {
	console.log('getMetadata for', url);
	const html = await fetch(url).then((res) => res.text());
	const firstParagraph = html.match(/<p[^>]*>(.*?)<\/p>/)?.[1];
	console.log('firstParagraph', firstParagraph);
	const articleExtractorMetadata = await articleExtractorScraper(html, url);
	console.log('articleExtractorMetadata', articleExtractorMetadata);
	const faviconMetadata = await faviconScraper(html, url);
	console.log('faviconMetadata', faviconMetadata);
	const urlMetadataMetadata = await urlMetadataScraper(html, url);
	console.log('urlMetadataMetadata', urlMetadataMetadata);

	const domain = new URL(url).hostname.replace('www.', '');
	console.log('domain', domain);
	const contentText = articleExtractorMetadata?.contentHtml
		? htmlToText(articleExtractorMetadata.contentHtml)
		: '';

	console.log('contentText', contentText);

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
		contentHtml: articleExtractorMetadata?.contentHtml || '',
		contentType: '',
		contentPublishedDate: urlMetadataMetadata?.contentPublishedDate || '',
		mainImage: '',
		mainImageUrl: urlMetadataMetadata?.mainImageUrl || articleExtractorMetadata?.mainImageUrl || '',
		icon: '',
		iconUrl: faviconMetadata?.iconUrl || ''
	};
}

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

	return {
		url: urlMetadataMetadata?.url || urlMetadataMetadata?.['og:url'],
		title: urlMetadataMetadata?.title || urlMetadataMetadata?.['og:title'],
		description: urlMetadataMetadata?.description || urlMetadataMetadata?.['og:description'],
		author: urlMetadataMetadata?.author || urlMetadataMetadata?.['twitter:creator'],
		mainImageUrl: urlMetadataMetadata?.image || urlMetadataMetadata?.['og:image']
	};
}

export async function getMetadataFromHtml(html: string, url: string) {
	const urlMetadataMetadata = await urlMetadataScraper(html, url);
	const articleExtractorMetadata = await articleExtractorScraper(html, url);
	const faviconMetadata = await faviconScraper(html, url);

	const firstParagraph = faviconMetadata.contentHtml?.match(/<p[^>]*>(.*?)<\/p>/)?.[1];

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
		contentHtml:
			urlMetadataMetadata?.contentHtml ||
			articleExtractorMetadata?.contentHtml ||
			sanitizeHtml(html) ||
			'',
		contentType: '',
		contentPublishedDate: urlMetadataMetadata?.contentPublishedDate || '',
		mainImage: '',
		mainImageUrl: urlMetadataMetadata?.mainImageUrl || articleExtractorMetadata?.mainImageUrl || '',
		icon: '',
		iconUrl: urlMetadataMetadata?.iconUrl || faviconMetadata?.iconUrl || ''
	};
}
