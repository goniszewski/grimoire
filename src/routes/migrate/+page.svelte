<script lang="ts">
import { applyAction, enhance } from '$app/forms';
import { showToast } from '$lib/utils/show-toast';
import { IconCircleCheck, IconExclamationCircle } from '@tabler/icons-svelte';

export let form: HTMLFormElement;

let step = 1;
const maxSteps = 3;
let loading = false;
let migrationResult: any;
let backupFilePath = '' as unknown;
let backupFileSelected = false;
</script>

<!-- Step 1: Connect to PocketBase and validate root admin credentials -->
<!-- Step 2: Validate admin credentials -->

{#if form?.invalid}
	<div role="alert" class="alert alert-error">
		<IconExclamationCircle />
		<span> Incorrect credentials. </span>
	</div>
{/if}

<h1 class="text-2xl font-bold">Migrate to new version</h1>

<div class="m-2 flex flex-col items-center">
	<progress class="progress progress-primary w-56" value={(step * 100) / maxSteps} max="100"
	></progress>
	<span class="mt-2 text-sm text-gray-300">Step {step} of {maxSteps}</span>
</div>

<div class="mt-8 w-full">
	<form method="POST">
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
							form?.invalid || (form?.missing && form?.login) ? 'input-error' : ''
						}`} />
					{#if form?.missing && form?.login}
						<p class="text-error">This field is required.</p>
					{/if}
				</div>

				<div>
					<label for="login" class="label">
						<span class="label-text">Root admin email</span>
					</label>
					<input
						type="text"
						name="login"
						placeholder="Type here"
						class={`input input-bordered w-full max-w-xs ${
							form?.invalid || (form?.missing && form?.login) ? 'input-error' : ''
						}`} />
					{#if form?.missing && form?.login}
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
				<button class="btn btn-primary btn-sm" on:submit|preventDefault on:click={() => step++}
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
							<h3 class="mx-auto text-lg">All set!</h3>
							<input type="hidden" name="backupFilePath" value={backupFilePath} />
							<button type="submit" class="btn btn-primary">Start migration</button>
						</div>
					</form>
				{/if}
			{:else if step === 3}
				{#if loading}
					<div class="mt-10 flex flex-col items-center justify-center gap-2">
						Migration in progress...
						<span class="loading loading-infinity loading-lg"></span>
					</div>
				{:else}
					<h2 class="m-auto text-3xl">Migration completed!</h2>
					<div class="mt-10 flex flex-col gap-2">
						<h3 class="text-xl">Migration results:</h3>
						<ul class="flex flex-col gap-1">
							<li class="flex gap-2">
								<IconCircleCheck class="text-green-500" />imported
								<span class="text-primary">
									<span class=" text-green-400">{0}</span>
									users</span
								>,
							</li>
							<li class="flex gap-2">
								<IconCircleCheck class="text-green-500" />which had
								<span class="text-primary">
									<span class=" text-green-400">{0}</span>
									bookmarks</span
								>,
							</li>
							<li class="flex gap-2">
								<IconCircleCheck class="text-green-500" />placed inside
								<span class="text-primary">
									<span class=" text-green-400">{0}</span>
									categories</span
								>,
							</li>
							<li class="flex gap-2">
								<IconCircleCheck class="text-green-500" />and associated with
								<span class="text-primary">
									<span class=" text-green-400">{0}</span>
									tags</span
								>,
							</li>
							<li class="flex gap-2">
								<IconCircleCheck class="text-green-500" />with a total of
								<span class="text-primary">
									<span class=" text-green-400">{0}</span>
									stored images</span
								>!
							</li>
						</ul>
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
					>Initiate from file</button>
			</div>
		</form>
	{/if}
</div>
