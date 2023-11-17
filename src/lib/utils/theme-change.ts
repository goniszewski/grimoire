import { themes } from '$lib/enums/themes';

export function themeChange(theme: keyof typeof themes) {
	document.documentElement.setAttribute('data-theme', themes[theme]);
	document.cookie = `theme=${theme}; ${document.cookie}`;
}
