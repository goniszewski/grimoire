import { urls } from '$lib/enums/urls';

export function getFileUrl(collectionName: string, entityId: string, filename: string) {
	return `${urls.INTERNAL_FILES}/${collectionName}/${entityId}/${filename}`;
}
