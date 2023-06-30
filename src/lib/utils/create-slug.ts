export function createSlug(text: string) {
	return text
		.toString()
		.toLowerCase()
		.normalize('NFD')
		.trim()
		.replace(/\s+/g, '-') // Replace spaces with -
		.replace(/[^\w\-]+/g, '') // Remove all non-word chars
		.replace(/\-\-+/g, '-'); // Replace multiple - with single -
}
