<script lang="ts">
	import { enhance } from '$app/forms';
	import { themes } from '$lib/enums/themes';
	import { IconMoon, IconSunHigh } from '@tabler/icons-svelte';

	let themeSwitchForm: HTMLFormElement;

	function handleThemeChange(theme: keyof typeof themes) {
		console.log(theme);
		document.documentElement.setAttribute('data-theme', themes[theme]);
		document.cookie = `theme=${themes[theme]}; ${document.cookie}`;
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
	<label class="swap swap-rotate btn btn-sm btn-circle">
		<input
			id="theme"
			name="theme"
			type="checkbox"
			checked={document.documentElement.getAttribute('data-theme') === themes.dark}
			on:change={() => themeSwitchForm.requestSubmit()}
		/>
		<IconSunHigh size={20} class="swap-on" />
		<IconMoon size={20} class="swap-off" />
	</label>
</form>
