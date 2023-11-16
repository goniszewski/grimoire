import type { sortByType } from '$lib/utils/sort-bookmarks';

export type llmSettings = {
	enabled: boolean;
	provider: 'ollama' | 'openai';
	ollama: {
		url: string;
		model: string;
		generateTags: {
			enabled: boolean;
			system: string;
		};
		summarize: {
			enabled: boolean;
			system: string;
		};
	};
	openai: {
		apiKey: string;
	};
};

export type UserSettings = {
	bookmarksView: 'list' | 'grid';
	bookmarksSortedBy: sortByType;
	bookmarksOnlyShowFlagged: boolean;
	bookmarksOnlyShowRead: boolean;
	theme: 'light' | 'dark';
	llm: llmSettings;
	uiAnimations: boolean;
};
