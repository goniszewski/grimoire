<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import { defaultConfig, getModels } from '$lib/integrations/ollama';
	import { user } from '$lib/pb';
	import { userSettingsStore } from '$lib/stores/user-settings.store';
	import type { UserSettings } from '$lib/types/UserSettings.type';
	import { showToast } from '$lib/utils/show-toast';
	import { themeChange } from '$lib/utils/theme-change';
	import { IconPlug, IconPlugConnected } from '@tabler/icons-svelte';
	import { writable } from 'svelte/store';

	const updatedSettings = writable<Pick<UserSettings, 'llm' | 'uiAnimations' | 'theme'>>({
		...$userSettingsStore
	});

	const llmModels = writable<{ fetched: boolean; models: string[] }>({
		fetched: false,
		models: [...([$userSettingsStore.llm?.ollama?.model] || [])]
	});

	async function onTestConnection() {
		const url =
			document.querySelector<HTMLInputElement>('[name="llmOllamaUrl"]')?.value ||
			'http://localhost:11434';
		const models = await getModels(url);
		llmModels.set({ models, fetched: true });
		showToast.success('Connection successful!');
	}

	let form: HTMLFormElement;
</script>

<div class="flex flex-col gap-8 w-full">
	<h1 class="text-2xl font-bold">User settings</h1>
	{#if !$user || !$user.isValid}
		<p>Not logged in.</p>
	{:else}
		<form
			bind:this={form}
			class="flex flex-col gap-8 w-full"
			method="POST"
			action="?/updateUserSettings"
			use:enhance={({ formData }) => {
				// @ts-ignore
				formData.set('settings', JSON.stringify($updatedSettings));

				return async ({ result }) => {
					// @ts-ignore
					if (result.type === 'success' && result.data?.updatedSettings) {
						// @ts-ignore
						userSettingsStore.set(result.data.updatedSettings);
						// @ts-ignore
						themeChange(result.data.updatedSettings.theme);
						showToast.success('Settings updated!');

						await applyAction(result);
					}
				};
			}}
		>
			<div class="flex flex-col gap-4">
				<h2 class="text-xl font-bold">UI</h2>
				<div class="flex border rounded-md p-4 gap-2">
					<table class="table table-xs max-w-[25rem]">
						<tr>
							<td><span class="label-text min-w-[8rem]">Theme (save to keep)</span></td>
							<td>
								<select
									name="theme"
									class="select select-bordered w-full max-w-xs"
									value={$userSettingsStore.theme}
									on:change={(e) => {
										// @ts-ignore
										$updatedSettings.theme = e.target.value;
									}}
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
									class="checkbox checkbox-accent"
									checked={$userSettingsStore.uiAnimations}
									on:change={(e) => {
										// @ts-ignore
										$updatedSettings.uiAnimations = e.target.checked;
									}}
								/></td
							>
						</tr>
					</table>
				</div>
			</div>

			<div class="flex flex-col gap-4">
				<h2 class="text-xl font-bold">AI Features</h2>
				<div class="flex border rounded-md p-4 gap-2">
					<table class="table table-xs w-full">
						<tr>
							<td><span class="label-text min-w-[8rem]">Enabled</span></td>
							<td
								><input
									type="checkbox"
									name="llmEnabled"
									class="checkbox checkbox-accent"
									checked={$userSettingsStore.llm.enabled}
									on:change={(e) => {
										// @ts-ignore
										$updatedSettings.llm.enabled = e.target.checked;
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
									value={$userSettingsStore.llm.provider}
									on:change={(e) => {
										// @ts-ignore
										$updatedSettings.provider = e.target.value;
									}}
								>
									<option value="openai">OpenAI</option>
									<option value="ollama">Ollama</option>
								</select>
							</td>
						</tr>
						{#if $updatedSettings.llm.provider === 'ollama'}
							<tr>
								<td>
									<span class="label-text min-w-[8rem]">Ollama URL</span>
								</td>
								<td>
									<input
										type="text"
										name="llmOllamaUrl"
										class={`input input-bordered w-full max-w-xs ${
											$llmModels.fetched ? ' border-success' : ''
										}`}
										value={$userSettingsStore.llm.ollama.url}
										placeholder="http://localhost:11434"
										on:change={(e) => {
											// @ts-ignore
											$updatedSettings.llm.ollama.url = e.target.value;
										}}
									/>
									<button
										class={`btn btn-sm ${$llmModels.fetched ? 'btn-success' : ' btn-warning'}`}
										on:click={(el) => {
											onTestConnection();
											el.preventDefault();
										}}
										>Test
										{#if $llmModels.fetched}
											<IconPlugConnected class="w-4 h-4" />
										{:else}
											<IconPlug class="w-4 h-4" />
										{/if}
									</button>
								</td>
							</tr>
							{#if $llmModels.models.length || $userSettingsStore.llm.ollama.model}
								<tr>
									<td>
										<span class="label-text min-w-[8rem]">Model</span>
									</td>
									<td>
										<select
											name="llmOllamaModel"
											class="select select-bordered w-full max-w-xs"
											value={$userSettingsStore.llm.ollama.model}
											placeholder="Select a model you wish to use"
											on:change={(e) => {
												// @ts-ignore
												$updatedSettings.llm.ollama.model = e.target.value;
											}}
										>
											{#each $llmModels.models as model}
												<option value={model}>{model}</option>
											{/each}
										</select>
									</td>
								</tr>
							{/if}
						{:else if $updatedSettings.llm.provider === 'openai'}
							<tr>
								<td>
									<span class="label-text">API Key</span>
								</td>
								<td>
									<input
										type="text"
										name="llmOpenaiApikey"
										class="input input-bordered w-full max-w-xs"
										value={$userSettingsStore.llm.openai.apiKey}
										placeholder="Paste it here..."
										on:change={(e) => {
											// @ts-ignore
											$updatedSettings.llm.openai.apiKey = e.target.value;
										}}
									/>
								</td>
							</tr>
						{/if}
					</table>
					<table class="table table-xs w-full">
						{#if $updatedSettings.llm.provider === 'ollama'}
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
										checked={$userSettingsStore.llm.ollama.summarize.enabled}
										class="checkbox checkbox-accent"
										on:change={(e) => {
											// @ts-ignore
											$updatedSettings.llm.ollama.summarize.enabled = e.target.checked;
										}}
									/>
								</td>
								<td
									><textarea
										name="llmOllamaSystemmsg"
										class="textarea textarea-bordered textarea-sm w-full min-w-[8rem]"
										value={$userSettingsStore.llm.ollama.summarize.system}
										placeholder={defaultConfig.roles.summarize.system}
										on:change={(e) => {
											// @ts-ignore
											$updatedSettings.llm.ollama.summarize.system = e.target.value;
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
										checked={$userSettingsStore.llm.ollama.generateTags.enabled}
										class="checkbox checkbox-accent"
										on:change={(e) => {
											// @ts-ignore
											$updatedSettings.llm.ollama.generateTags.enabled = e.target.checked;
										}}
									/>
								</td>
								<td
									><textarea
										name="llmOllamaSystemmsg"
										class="textarea textarea-bordered textarea-sm w-full min-w-[8rem]"
										value={$userSettingsStore.llm.ollama.generateTags.system}
										placeholder={defaultConfig.roles.generateTags.system}
										on:change={(e) => {
											// @ts-ignore
											$updatedSettings.llm.ollama.generateTags.system = e.target.value;
										}}
									/></td
								>
							</tr>
						{/if}
					</table>
				</div>
			</div>
			<div class="flex justify-end gap-4">
				<button class="btn btn-primary" on:click={() => form.requestSubmit()}> Save </button>
			</div>
		</form>
	{/if}
</div>
