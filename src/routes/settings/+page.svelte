<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import { page } from '$app/stores';
	import { defaultUserSettings } from '$lib/config';
	import { defaultConfig, listAvailableModels } from '$lib/integrations/ollama';
	import type { UserSettings } from '$lib/types/UserSettings.type';
	import { showToast } from '$lib/utils/show-toast';
	import { themeChange } from '$lib/utils/theme-change';
	import { IconPlug, IconPlugConnected } from '@tabler/icons-svelte';
	import { writable } from 'svelte/store';

	const userSettingsStore = writable<UserSettings>({
		...defaultUserSettings,
		...$page.data.user?.settings
	});

	const llmModels = writable<{ fetched: boolean; models: string[] }>({
		fetched: false,
		models: [$page.data.user?.settings.llm.ollama.model ?? '']
	});

	function resetToDefaults() {
		userSettingsStore.set(defaultUserSettings);
		showToast.success('Settings reset to defaults. Remember to save!', {
			duration: 3000
		});
	}

	async function onTestConnection() {
		const url =
			document.querySelector<HTMLInputElement>('[name="llmOllamaUrl"]')?.value ||
			'http://localhost:11434';
		const models = await listAvailableModels({ url });
		llmModels.set({ models, fetched: true });
		showToast.success('Connection successful!');
	}

	let form: HTMLFormElement;
</script>

<div class="flex w-full flex-col gap-8">
	<h1 class="text-2xl font-bold">User settings</h1>
	{#if !$page.data.user || $page.data.user.disabled}
		<p>Not logged in.</p>
	{:else}
		<form
			bind:this={form}
			class="flex w-full flex-col gap-8"
			method="POST"
			action="?/updateUserSettings"
			use:enhance={() => {
				return async ({ update, result }) => {
					if (result.type === 'success' && result?.data?.updatedSettings) {
						// @ts-ignore-next-line
						userSettingsStore.set(result.data.updatedSettings);
						// @ts-ignore-next-line
						themeChange(result.data.updatedSettings.theme);
						showToast.success('Settings updated!');
						await invalidate('/');
					}
					update();
				};
			}}
		>
			<div class="flex flex-col gap-4">
				<h2 class="text-xl font-bold">UI</h2>
				<div class="flex gap-2 rounded-md border p-4">
					<table class="table table-xs max-w-[25rem]">
						<tr>
							<td><span class="label-text min-w-[8rem]">Theme (save to keep)</span></td>
							<td>
								<select
									name="theme"
									class="select select-bordered w-full max-w-xs"
									bind:value={$userSettingsStore.theme}
								>
									<option value="light">Light</option>
									<option value="dark">Dark</option>
								</select>
							</td></tr
						>
						<tr>
							<td><span class="label-text min-w-[8rem]">Animations</span></td>
							<td
								><input
									type="checkbox"
									name="uiAnimations"
									class="checkbox-accent checkbox"
									checked={$page.data.user.settings.uiAnimations}
									on:change={(e) => {
										// @ts-ignore
										$userSettingsStore.uiAnimations = e.target.checked;
									}}
								/></td
							>
						</tr>
					</table>
				</div>
			</div>

			<div class="flex flex-col gap-4">
				<h2 class="text-xl font-bold">AI Features</h2>
				<div class="flex gap-2 rounded-md border p-4">
					<table class="table table-xs w-full">
						<tr>
							<td><span class="label-text min-w-[8rem]">Enabled</span></td>
							<td
								><input
									type="checkbox"
									name="llmEnabled"
									class="checkbox-accent checkbox"
									checked={$page.data.user.settings.llm.enabled}
									on:change={(e) => {
										// @ts-ignore
										$userSettingsStore.llm.enabled = e.target.checked;
									}}
								/></td
							>
						</tr>
						<tr>
							<td>
								<span class="label-text min-w-[8rem]">Provider</span>
							</td>
							<td>
								<select
									name="llmProvider"
									class="select select-bordered w-full max-w-xs"
									bind:value={$userSettingsStore.llm.provider}
								>
									<option value="openai">OpenAI</option>
									<option value="ollama">Ollama</option>
								</select>
							</td>
						</tr>
						{#if $userSettingsStore.llm.provider === 'ollama'}
							<tr>
								<td>
									<span class="label-text min-w-[8rem]">Ollama URL</span>
								</td>
								<td>
									<input
										type="text"
										name="llmOllamaUrl"
										class="input input-bordered w-full max-w-xs"
										class:border-success={$llmModels.fetched}
										bind:value={$userSettingsStore.llm.ollama.url}
										placeholder="http://localhost:11434"
									/>
									<button
										class={`btn btn-sm ${$llmModels.fetched ? 'btn-success' : ' btn-warning'}`}
										on:click={(el) => {
											onTestConnection();
											el.preventDefault();
										}}
										>Test
										{#if $llmModels.fetched}
											<IconPlugConnected class="h-4 w-4" />
										{:else}
											<IconPlug class="h-4 w-4" />
										{/if}
									</button>
								</td>
							</tr>
							{#if $llmModels.models.length || $page.data.user.settings.llm.ollama.model}
								<tr>
									<td>
										<span class="label-text min-w-[8rem]">Model</span>
									</td>
									<td>
										<select
											name="llmOllamaModel"
											class="select select-bordered w-full max-w-xs"
											value={$page.data.user.settings.llm.ollama.model}
											placeholder="Select a model you wish to use"
											on:change={(e) => {
												// @ts-ignore
												$userSettingsStore.llm.ollama.model = e.target.value;
											}}
										>
											{#each $llmModels.models as model}
												<option value={model}>{model}</option>
											{/each}
										</select>
									</td>
								</tr>
							{/if}
						{:else if $userSettingsStore.llm.provider === 'openai'}
							<tr>
								<td>
									<span class="label-text">API Key</span>
								</td>
								<td>
									<input
										type="text"
										name="llmOpenaiApikey"
										class="input input-bordered w-full max-w-xs"
										value={$page.data.user.settings.llm.openai.apiKey}
										placeholder="Paste it here..."
										on:change={(e) => {
											// @ts-ignore
											$userSettingsStore.llm.openai.apiKey = e.target.value;
										}}
									/>
								</td>
							</tr>
						{/if}
					</table>
					<table class="table table-xs w-full">
						{#if $userSettingsStore.llm.provider === 'ollama'}
							<thead>
								<tr>
									<th>Feature</th>
									<th>Enabled</th>
									<th>System message</th>
								</tr>
							</thead>
							<tr>
								<td>Summarize</td>
								<td>
									<input
										type="checkbox"
										name="llmOllamaSummarizeEnabled"
										bind:checked={$userSettingsStore.llm.ollama.summarize.enabled}
										class="checkbox-accent checkbox"
									/>
								</td>
								<td
									><textarea
										name="llmOllamaSystemmsg"
										class="textarea textarea-bordered textarea-sm w-full min-w-[8rem]"
										value={$page.data.user.settings.llm.ollama.summarize.system}
										placeholder={defaultConfig.roles.summarize.system}
										on:change={(e) => {
											// @ts-ignore
											$userSettingsStore.llm.ollama.summarize.system = e.target.value;
										}}
									/></td
								>
							</tr>
							<tr>
								<td>Generate tags</td>
								<td>
									<input
										type="checkbox"
										name="llmOllamaGenerateTagsEnabled"
										checked={$page.data.user.settings.llm.ollama.generateTags.enabled}
										class="checkbox-accent checkbox"
										on:change={(e) => {
											// @ts-ignore
											$userSettingsStore.llm.ollama.generateTags.enabled = e.target.checked;
										}}
									/>
								</td>
								<td
									><textarea
										name="llmOllamaSystemmsg"
										class="textarea textarea-bordered textarea-sm w-full min-w-[8rem]"
										value={$page.data.user.settings.llm.ollama.generateTags.system}
										placeholder={defaultConfig.roles.generateTags.system}
										on:change={(e) => {
											// @ts-ignore
											$userSettingsStore.llm.ollama.generateTags.system = e.target.value;
										}}
									/></td
								>
							</tr>
						{/if}
					</table>
				</div>
			</div>
			<div class="flex justify-end gap-4">
				<button class="btn btn-secondary" on:click|preventDefault={() => resetToDefaults()}>
					Reset to Defaults
				</button><button class="btn btn-primary"> Save </button>
			</div>
		</form>
	{/if}
</div>
