import type { sortByType } from '$lib/utils/sort-bookmarks';

export type ollamaSettings = {
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

export type llmSettings = {
	enabled: boolean;
	provider: 'ollama' | 'openai';
	ollama: ollamaSettings;
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
