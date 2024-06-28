<script lang="ts">
	import { enhance } from '$app/forms';
	import type { UserSettings } from '$lib/types/UserSettings.type';
	import { showToast } from '$lib/utils/show-toast';
	import { IconLock, IconLockOpen, IconTrash } from '@tabler/icons-svelte';
	import { writable } from 'svelte/store';
	import type { PageData } from './$types';

	export let data: PageData;
	const activeTab = writable('Users');
	const updatedSettings = writable({
		llm: {
			openai: {},
			ollama: {}
		}
	} as UserSettings);

	const tabs = [
		'Users',
		// 'AI Integrations',
		'PocketBase Settings [read-only]'
	];
</script>

{#if !$page.data.user?.isAdmin}
	<div class="flex h-full w-full flex-col items-center justify-center gap-4">
		<span> You are not logged in as admin. </span>
		<a href="/admin/login" class="btn btn-primary">Go to admin login page</a>
	</div>
{:else}
	<div class="flex w-full flex-col gap-4">
		<h1 class="m-auto text-2xl">Admin Panel</h1>
		<p class="ml-auto">Logged as <strong>{$page.data.user?.email}</strong></p>
		<div class="my-4 flex flex-col gap-2">
			{#if !data.adminData}
				<p>Loading...</p>
			{:else}
				<div class="tabs tabs-lifted">
					{#each tabs as tab}
						<button
							class={`tab ${tab === $activeTab ? 'tab-active' : ''}`}
							on:click={() => ($activeTab = tab)}>{tab}</button
						>
					{/each}
				</div>
				{#if $activeTab === 'Users'}
					<!-- Users -->
					<div class="collapse collapse-arrow border border-base-300 bg-base-200">
						<input type="checkbox" checked />
						<div class="collapse-title text-xl font-medium">Users</div>
						<div class="collapse-content">
							<div class="overflow-x-auto rounded-md bg-base-100 p-4">
								<table class="table table-zebra table-sm">
									<!-- head -->
									<thead>
										<tr>
											<th>ID</th>
											<th>Name</th>
											<th>Username</th>
											<th>Email</th>
											<th>Categories </th>
											<th>Tags </th>
											<th>Bookmarks</th>
											<th>Actions</th>
										</tr>
									</thead>
									<!-- body -->
									<tbody>
										{#each data.adminData.users as user (user.id)}
											<tr>
												<td>{user.id}</td>
												<td>{user.username}</td>
												<td>{user.email || '-'}</td>
												<td>
													<div class="tooltip" data-tip="Categories count">
														<div class="grid px-2 py-1">{user.categoriesCount}</div>
													</div>
												</td>
												<td>
													<div class="divider divider-horizontal"></div>
													<div class="tooltip" data-tip="Tags count">
														<div class="grid px-2 py-1">{user.tagsCount}</div>
													</div>
												</td>
												<td>
													<div class="divider divider-horizontal"></div>
													<div class="tooltip" data-tip="Bookmarks count">
														<div class="grid px-2 py-1">
															{user.bookmarksCount}
														</div>
													</div>
												</td>
												<td>
													<div class="flex gap-1">
														<form
															method="POST"
															action="?/toggleUserDisabled"
															use:enhance={({ formData }) => {
																formData.set('userId', user.id.toString());
																formData.set('disable', user.disabled ? 'false' : 'true');

																return async ({ update }) => {
																	showToast.success(
																		`User access ${user.disabled ? 'enabled' : 'disabled'}`,
																		{
																			position: 'bottom-center'
																		}
																	);
																	update();
																};
															}}
														>
															{#if user.disabled}
																<div
																	class="tooltip tooltip-left"
																	data-tip="Unlock user - locked since {new Date(
																		user.disabled
																	).toLocaleString()}"
																>
																	<button class="btn btn-ghost btn-sm">
																		<IconLockOpen size={22} class="text-green-400" />
																	</button>
																</div>
															{:else}
																<div
																	class="tooltip tooltip-left"
																	data-tip="Lock user - user will not be able to log in, can be changed later"
																>
																	<button class="btn btn-ghost btn-sm">
																		<IconLock size={22} class="text-red-400" />
																	</button>
																</div>
															{/if}
														</form>
														<form
															method="POST"
															action="?/deleteUser"
															use:enhance={({ formData }) => {
																formData.set('userId', user.id.toString());

																return async ({ update }) => {
																	showToast.success(`User ${user.username} deleted`, {
																		position: 'bottom-center'
																	});
																	update();
																};
															}}
														>
															<div
																class="tooltip tooltip-left"
																data-tip="Delete user - this action is irreversible!"
															>
																<button class="btn btn-ghost btn-sm">
																	<IconTrash size={22} class="text-red-400" />
																</button>
															</div>
														</form>
													</div>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				{:else if $activeTab === 'AI Integrations'}
					<!-- LLMs -->
					<div class="collapse collapse-arrow border border-base-300 bg-base-200">
						<input type="checkbox" checked />
						<div class="collapse-title text-xl font-medium">AI Integrations</div>
						<div class="collapse-content">
							<div class="overflow-x-auto">
								<form>
									<div class="form-control">
										<!-- select to choose provider -->
										<select
											name="aiProvider"
											class="select select-bordered w-full"
											value={$updatedSettings.llm.provider || data.adminData.settings.llm.provider}
											on:change={(event) => {
												// @ts-ignore
												$updatedSettings.llm.provider = event.target.value;
											}}
										>
											<option value="none">None</option>
											<option value="openai">OpenAI (ChatGPT)</option>
											<option value="ollama">Ollama</option>
										</select>
									</div>

									{#if $updatedSettings.llm.provider === 'openai'}
										<div class="form-control">
											<label for="aiOpenaiApiKey" class="label">
												<span class="label-text">OpenAI API Key</span>
											</label>
											<input
												type="text"
												name="aiOpenaiApiKey"
												value={data.adminData.settings.llm.openai.apiKey}
												class="input input-bordered w-full"
											/>
										</div>
									{/if}

									{#if $updatedSettings.llm.provider === 'ollama'}
										<div class="form-control">
											<label for="aiOllamaApiKey" class="label">
												<span class="label-text">Ollama URL</span>
											</label>
											<input
												type="text"
												name="aiOllamaApiKey"
												value={$updatedSettings.llm?.ollama?.url ||
													data.adminData.settings.llm.ollama.url}
												placeholder="E.g. http://localhost:11434"
												class="input input-bordered w-full"
												on:input={(event) => {
													// @ts-ignore
													$updatedSettings.llm.ollama.url = event.target.value;
												}}
											/>
										</div>
									{/if}
								</form>
							</div>
						</div>
					</div>
				{/if}
			{/if}
		</div>
	</div>
{/if}
