import { convert } from 'html-to-text';
import metascraper from 'metascraper';
import metascraperAuthor from 'metascraper-author';
import metascraperClearbit from 'metascraper-clearbit';
import metascraperDate from 'metascraper-date';
import metascraperDescription from 'metascraper-description';
import metascraperImage from 'metascraper-image';
import metascraperLogo from 'metascraper-logo';
import metascraperPublisher from 'metascraper-publisher';
import metascraperTitle from 'metascraper-title';
import metascraperUrl from 'metascraper-url';
import sanitize from 'sanitize-html';

import { extract, extractFromHtml } from '@extractus/article-extractor';

import type { Metadata } from '$lib/types/Metadata.type';

const metascraperScraper = async (html: string, url: string): Promise<Partial<Metadata>> => {
	const metascraperInstance = metascraper([
		metascraperAuthor(),
		metascraperDate(),
		metascraperDescription(),
		metascraperImage(),
		metascraperLogo(),
		metascraperClearbit(),
		metascraperPublisher(),
		metascraperTitle(),
		metascraperUrl()
	]);

	const metascraperMetadata = await metascraperInstance({ html, url });

	return {
		url: metascraperMetadata?.url,
		title: metascraperMetadata?.title,
		description: metascraperMetadata?.description,
		author: metascraperMetadata?.author,
		contentPublishedDate: metascraperMetadata?.date ? new Date(metascraperMetadata?.date) : null,
		mainImageUrl: metascraperMetadata?.image
	};
};

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
	const html = await fetch(url).then((res) => res.text());
	const firstParagraph = html.match(/<p[^>]*>(.*?)<\/p>/)?.[1];

	const metascraperMetadata = await metascraperScraper(html, url);
	const articleExtractorMetadata = await articleExtractorScraper(html, url);
	const faviconMetadata = await faviconScraper(html, url);

	const domain = new URL(url).hostname.replace('www.', '');
	const content_text = articleExtractorMetadata?.contentHtml
		? htmlToText(articleExtractorMetadata.contentHtml)
		: '';

	return {
		url: metascraperMetadata?.url || articleExtractorMetadata?.url || '',
		domain,
		title: metascraperMetadata?.title || articleExtractorMetadata?.title || '',
		description:
			metascraperMetadata?.description ||
			articleExtractorMetadata?.description ||
			firstParagraph ||
			'',
		author: metascraperMetadata?.author || articleExtractorMetadata?.author || '',
		content_text,
		content_html: articleExtractorMetadata?.contentHtml || '',
		content_type: '',
		content_published_date: metascraperMetadata?.contentPublishedDate || '',
		main_image: '',
		main_image_url:
			metascraperMetadata?.mainImageUrl || articleExtractorMetadata?.mainImageUrl || '',
		icon: '',
		icon_url: faviconMetadata?.iconUrl || ''
	};
}

export async function getMetadataFromHtml(html: string, url: string) {
	const metascraperMetadata = await metascraperScraper(html, url);
	const articleExtractorMetadata = await articleExtractorScraper(html, url);
	const faviconMetadata = await faviconScraper(html, url);

	const firstParagraph = faviconMetadata.contentHtml?.match(/<p[^>]*>(.*?)<\/p>/)?.[1];

	const domain = new URL(url).hostname.replace('www.', '');
	const contentText = articleExtractorMetadata?.contentHtml
		? htmlToText(articleExtractorMetadata.contentHtml) || htmlToText(html)
		: '';

	return {
		url: metascraperMetadata?.url || articleExtractorMetadata?.url || '',
		domain,
		title: metascraperMetadata?.title || articleExtractorMetadata?.title || '',
		description:
			metascraperMetadata?.description ||
			articleExtractorMetadata?.description ||
			firstParagraph ||
			'',
		author: metascraperMetadata?.author || articleExtractorMetadata?.author || '',
		contentText,
		contentHtml: articleExtractorMetadata?.contentHtml || sanitizeHtml(html) || '',
		contentType: '',
		contentPublishedDate: metascraperMetadata?.contentPublishedDate || '',
		mainImage: '',
		mainImageUrl: metascraperMetadata?.mainImageUrl || articleExtractorMetadata?.mainImageUrl || '',
		icon: '',
		iconUrl: faviconMetadata?.iconUrl || ''
	};
}
