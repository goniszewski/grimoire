export function getFileUrl(collectionName: string, entityId: string, filename: string) {
	return `/internal/api/files/${collectionName}/${entityId}/${filename}`;
}
