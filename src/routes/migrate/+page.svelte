<script lang="ts">
import { applyAction, enhance } from '$app/forms';
import { page } from '$app/stores';
import type { MigrationResult } from '$lib/utils/data-migration/migration.types';
import { showToast } from '$lib/utils/show-toast';
import { IconCircleCheck, IconExclamationCircle } from '@tabler/icons-svelte';
import { writable } from 'svelte/store';

export let form: HTMLFormElement;

let step = 1;
const maxSteps = 3;
let loading = false;
const migrationResult = writable<MigrationResult | null>(null);
const userPassword = writable('lala');
let backupFilePath = '' as unknown;
let backupFileSelected = false;
const isMigrationAllowed = $page.data.noUsersFound || !!$page.data.user?.isAdmin;
</script>

<div class="indicator">
	<span class="badge indicator-item badge-neutral indicator-bottom"> preview </span>
	<h1 class="mb-2 text-2xl font-bold">Migrate data to new version</h1>
</div>

{#if !isMigrationAllowed}
	<div class="mt-[25vh] flex h-full flex-col items-center gap-4">
		<h1 class="text-xl font-bold">Migration is disabled!</h1>
		<p>Migration is disabled because of the following reasons:</p>
		<ul class="list-disc">
			{#if !$page.data.noUsersFound}
				<li>
					<span class="text-red-500"> Found existing users in the database. </span>
				</li>
			{/if}
			{#if !$page.data.user?.isAdmin}
				<li>
					<span class="text-red-500"> You are not an admin. </span>
				</li>
			{/if}
		</ul>
	</div>
{:else}
	<div class="m-2 flex flex-col items-center">
		<progress class="progress progress-primary w-56" value={(step * 100) / maxSteps} max="100"
		></progress>
		<span class="mt-2 text-sm text-gray-500">Step {step} of {maxSteps}</span>
	</div>

	<div class="mt-8 w-full">
		<form
			method="POST"
			action="?/connectToPb"
			use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						backupFilePath = result.data?.filePath;
						showToast.success('Backup file uploaded to: ' + result.data?.filePath, {
							position: 'bottom-center',
							style: 'word-break: break-word;',
							duration: 3000
						});
						step++;
						await applyAction(result);
					}
					if (result.type === 'error') {
						showToast.error(`Error: ${JSON.stringify(result?.error)}`, {
							position: 'bottom-center'
						});
					}
				};
			}}>
			<div class="form-control mx-auto max-w-xs gap-4">
				{#if step === 1}
					<h3 class="mx-auto text-lg">Provide PocketBase instance details</h3>

					<div>
						<label for="pbUrl" class="label">
							<span class="label-text">PocketBase URL</span>
						</label>
						<input
							type="text"
							name="pbUrl"
							placeholder="Type here"
							class={`input input-bordered w-full max-w-xs ${
								form?.invalid || (form?.missing && form?.pbUrl) ? 'input-error' : ''
							}`} />
						{#if form?.missing && form?.pbUrl}
							<p class="text-error">This field is required.</p>
						{/if}
					</div>

					<div>
						<label for="email" class="label">
							<span class="label-text">Root admin email</span>
						</label>
						<input
							type="email"
							name="email"
							placeholder="Type here"
							class={`input input-bordered w-full max-w-xs ${
								form?.invalid || (form?.missing && form?.email) ? 'input-error' : ''
							}`} />
						{#if form?.missing && form?.email}
							<p class="text-error">This field is required.</p>
						{/if}
					</div>

					<div>
						<label for="password" class="label">
							<span class="label-text">Root admin password</span>
						</label>
						<input
							type="password"
							name="password"
							placeholder="Type here"
							class={`input input-bordered w-full max-w-xs ${
								form?.invalid || (form?.missing && form?.password) ? 'input-error' : ''
							}`} />
						{#if form?.missing && form?.password}
							<p class="text-error">This field is required.</p>
						{/if}
					</div>
					<button type="submit" class="btn btn-primary btn-sm"
						>Connect and initiate full backup</button>
				{:else if step === 2}
					{#if !backupFilePath}
						Error: No backup file found.
					{:else}
						<form
							method="POST"
							action="?/runMigration"
							use:enhance={() => {
								return async ({ result }) => {
									if (result.type === 'success') {
										console.log('migrationResult', result.data?.result);
										$migrationResult = result.data?.result;
										$userPassword = result.data?.userPassword;
										step++;
										await applyAction(result);
									}
									if (result.type === 'error') {
										showToast.error(`Error: ${JSON.stringify(result?.error)}`, {
											position: 'bottom-center'
										});
									}
								};
							}}>
							<div class="form-control mx-auto max-w-xs gap-4">
								<h3 class="mx-auto text-lg">All set!</h3>
								<input type="hidden" name="backupFilePath" value={backupFilePath} />
								<button type="submit" class="btn btn-primary"
									>Start migration using PocketBase</button>
							</div>
						</form>
					{/if}
				{:else if step === 3}
					{#if loading}
						<div class="mt-10 flex flex-col items-center justify-center gap-2">
							Migration in progress...
							<span class="loading loading-infinity loading-lg"></span>
						</div>
					{:else if $migrationResult?.count}
						{@const { users, bookmarks, categories, tags, images } = $migrationResult?.count}

						<h2 class="m-auto text-3xl">Migration completed!</h2>
						<div class="mt-10 flex flex-col gap-2">
							<h3 class="text-xl">During this migration we have...</h3>
							<ul class="flex flex-col gap-y-1">
								<li class="flex gap-2">
									<IconCircleCheck class="text-green-500" />
									<div>
										imported
										<span class="text-primary">
											<span class="text-green-400">{users}</span>
											users</span
										>,
									</div>
								</li>
								<li class="flex gap-2">
									<IconCircleCheck class="text-green-500" />
									<div>
										who had
										<span class="text-primary">
											<span class="text-green-400">{bookmarks}</span>
											bookmarks</span
										>,
									</div>
								</li>
								<li class="flex gap-2">
									<IconCircleCheck class="text-green-500" />
									<div>
										organized into
										<span class="text-primary">
											<span class="text-green-400">{categories}</span>
											categories</span
										>,
									</div>
								</li>
								<li class="flex gap-2">
									<IconCircleCheck class="text-green-500" />
									<div>
										and tagged with
										<span class="text-primary">
											<span class="text-green-400">{tags}</span>
											tags</span
										>,
									</div>
								</li>
								<li class="flex gap-2">
									<IconCircleCheck class="text-green-500" />
									<div>
										with a total of
										<span class="text-primary">
											<span class="text-green-400">{images}</span>
											stored images</span
										>!
									</div>
								</li>
							</ul>
							<div role="alert" class="alert mt-4 border-warning">
								<IconExclamationCircle />
								<div class="flex flex-col gap-2">
									<span>
										Important: All imported users must use the temporary password <span
											class="badge badge-secondary badge-outline">{$userPassword}</span> for their first
										login.
									</span>
									<span
										>Inform them to change this password immediately in <a
											href="/settings"
											class="link">User Settings</a
										>!</span>
								</div>
							</div>
						</div>
					{/if}
				{/if}
			</div>
		</form>
		{#if step === 1}
			<div class="divider py-4">OR</div>
			<form
				method="POST"
				action="?/useExistingBackupFile"
				enctype="multipart/form-data"
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'success') {
							backupFilePath = result.data?.filePath;
							showToast.success('Backup file uploaded to: ' + result.data?.filePath, {
								position: 'bottom-center',
								style: 'word-break: break-word;',
								duration: 3000
							});
							step++;
							await applyAction(result);
						}
						if (result.type === 'error') {
							showToast.error(`Error: ${JSON.stringify(result?.error)}`, {
								position: 'bottom-center'
							});
						}
					};
				}}>
				<div class="form-control mx-auto max-w-xs gap-4">
					<h3 class="mx-auto text-lg">Select existing backup file</h3>
					<input
						type="file"
						title="Select backup file"
						id="backup"
						name="backup"
						accept=".zip"
						multiple={false}
						class="file-input file-input-bordered file-input-primary file-input-md w-full max-w-xs"
						on:change={(e) => (backupFileSelected = e?.target?.files?.length > 0)} />
					<button type="submit" class="btn btn-primary btn-sm" disabled={!backupFileSelected}
						>Start migration using backup file</button>
				</div>
			</form>
		{/if}
	</div>
{/if}
