export const checkIfImageURL = (url: string) => {
	const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico'];

	return ALLOWED_EXTENSIONS.includes(url.split('.').pop() as string);
};
