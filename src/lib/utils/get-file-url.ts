import { urls } from '$lib/enums/urls';

export function getFileUrl(relativePath?: string) {
	return relativePath ? `${urls.INTERNAL_FILES}/${relativePath};` : null;
}
