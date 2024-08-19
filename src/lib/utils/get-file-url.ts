import { urls } from '$lib/enums/urls';

export function getFileUrl(relativePath?: string): string | null {
	return relativePath ? `${urls.INTERNAL_FILES}/${relativePath}` : null;
}
