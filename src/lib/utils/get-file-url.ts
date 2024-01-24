import config from '$lib/config';

export function getFileUrl(collectionName: string, entityId: string, filename: string) {
	return `${config.BACKEND_URL}/api/files/${collectionName}/${entityId}/${filename}`;
}
