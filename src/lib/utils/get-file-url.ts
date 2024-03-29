import config from '$lib/config';

export function getFileUrl(collectionName: string, entityId: string, filename: string) {
	return `/internal/files/${collectionName}/${entityId}/${filename}`;
}
