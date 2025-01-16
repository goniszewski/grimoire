import type { ImportResult } from '$lib/types/BookmarkImport.type';
import { importNetscapeBackup } from './bookmark-import/netscape.importer';

type ImportProviders = {
	netscape: (content: string) => Promise<ImportResult>;
};

export async function importBookmarks(
	content: string,
	provider: keyof ImportProviders
): Promise<ImportResult> {
	const providers: ImportProviders = {
		netscape: importNetscapeBackup
	};

	return providers[provider](content);
}
