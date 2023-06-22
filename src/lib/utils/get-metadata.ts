import metascraper from 'metascraper';
import metascraperAuthor from 'metascraper-author';
import metascraperDate from 'metascraper-date';
import metascraperDescription from 'metascraper-description';
import metascraperImage from 'metascraper-image';
import metascraperLogo from 'metascraper-logo';
import metascraperClearbit from 'metascraper-clearbit';
import metascraperPublisher from 'metascraper-publisher';
import metascraperTitle from 'metascraper-title';
import metascraperUrl from 'metascraper-url';
import { extract } from '@extractus/article-extractor';
import { convert } from 'html-to-text';
import sanitize from 'sanitize-html';
import type { Metadata } from '$lib/interfaces/Metadata.interface';

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
		content_published_date: metascraperMetadata?.date ? new Date(metascraperMetadata?.date) : null,
		main_image_url: metascraperMetadata?.image
	};
};

const articleExtractorScraper = async (html: string, _url: string): Promise<Partial<Metadata>> => {
	const articleExtractorMetadata = await extract(html);

	return {
		url: articleExtractorMetadata?.url,
		title: articleExtractorMetadata?.title,
		description: articleExtractorMetadata?.description,
		author: articleExtractorMetadata?.author,
		main_image_url: articleExtractorMetadata?.image,
		content_html: articleExtractorMetadata?.content
			? sanitizeHtml(articleExtractorMetadata?.content)
			: '',
		content_published_date: articleExtractorMetadata?.published
			? new Date(articleExtractorMetadata?.published)
			: null
	};
};

const faviconScraper = async (html: string, url: string): Promise<Partial<Metadata>> => {
	const baseUrl = new URL(url).origin;
	const matchedElements = html.match(
		/<link[^>]*rel=["'](?:icon|shortcut icon|apple-touch-icon-precomposed|apple-touch-icon|mask-icon|fluid-icon|manifest)["'][^>]*>/gim
	);

	const favicon = matchedElements?.reduce((acc, element) => {
		if (acc) return acc;
		const hrefMatch = element.match(/href="([^"]*)"/);
		if (!hrefMatch) return '';
		let faviconUrl = hrefMatch[1];
		if (faviconUrl.startsWith('/')) {
			faviconUrl = `${baseUrl}${faviconUrl.replace('//', '/')}`;
		}
		return faviconUrl;
	}, '');

	return {
		icon_url: favicon || ''
	};
};

const htmlToText = (html: string) => convert(html, { wordwrap: false });
const sanitizeHtml = (html: string) => sanitize(html);

export async function getMetadata(url: string) {
	const html = await fetch(url).then((res) => res.text());

	const metascraperMetadata = await metascraperScraper(html, url);
	const articleExtractorMetadata = await articleExtractorScraper(html, url);
	const faviconMetadata = await faviconScraper(html, url);

	const domain = new URL(url).hostname.replace('www.', '');
	const content_text = articleExtractorMetadata?.content_html
		? htmlToText(articleExtractorMetadata.content_html)
		: '';

	return {
		url: metascraperMetadata?.url || articleExtractorMetadata?.url || '',
		domain: domain || '',
		title: metascraperMetadata?.title || articleExtractorMetadata?.title || '',
		description: metascraperMetadata?.description || articleExtractorMetadata?.description || '',
		author: metascraperMetadata?.author || articleExtractorMetadata?.author || '',
		content_text,
		content_html: articleExtractorMetadata?.content_html || '',
		content_type: '',
		content_published_date: metascraperMetadata?.content_published_date || new Date(),
		main_image: '',
		main_image_url:
			metascraperMetadata?.main_image_url || articleExtractorMetadata?.main_image_url || '',
		icon: '',
		icon_url: faviconMetadata?.icon_url || '',
		metascraperMetadata,
		articleExtractorMetadata
	};
}
