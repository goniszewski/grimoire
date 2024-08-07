<script lang="ts">
	import { enhance } from '$app/forms';
	import { themes } from '$lib/enums/themes';
	import type { User } from '$lib/types/User.type';
	import { IconMoon, IconSunHigh } from '@tabler/icons-svelte';

	export let user: User | null = null;
	let themeSwitchForm: HTMLFormElement;

	$: theme = user?.settings?.theme ?? 'light';

	function handleThemeChange(theme: keyof typeof themes) {
		document.documentElement.setAttribute('data-theme', themes[theme]);
		document.cookie = `theme=${theme}; ${document.cookie}`;
	}
</script>

<form
	bind:this={themeSwitchForm}
	method="POST"
	action="/?/changeTheme"
	use:enhance={({ formData }) => {
		const theme = formData.get('theme')?.toString() === 'on' ? 'dark' : 'light';
		formData.set('theme', theme);
		handleThemeChange(theme);

		return async () => {};
	}}
>
	<label class="btn btn-circle swap swap-rotate btn-sm">
		<input
			id="theme"
			name="theme"
			type="checkbox"
			checked={theme === 'dark'}
			on:change={() => themeSwitchForm.requestSubmit()}
		/>
		<IconSunHigh size={20} class="swap-on" />
		<IconMoon size={20} class="swap-off" />
	</label>
</form>
