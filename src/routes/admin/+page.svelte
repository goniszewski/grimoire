<script lang="ts">
	import { enhance } from '$app/forms';
	import { user } from '$lib/pb';
	import type { UserSettings } from '$lib/types/UserSettings.type';
	import { showToast } from '$lib/utils/show-toast';
	import { IconInfoCircle, IconLock, IconLockOpen, IconTrash } from '@tabler/icons-svelte';
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

{#if !$user.isAdmin}
	<div class="flex h-full w-full flex-col items-center justify-center gap-4">
		<span> You are not logged in as admin. </span>
		<a href="/admin/login" class="btn btn-primary">Go to admin login page</a>
	</div>
{:else}
	<div class="flex w-full flex-col gap-4">
		<h1 class="m-auto text-2xl">Admin Panel</h1>
		<p class="ml-auto">Logged as <strong>{$user.model.email}</strong></p>
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
												<td>{user.name}</td>
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
																formData.set('userId', user.id);
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
																formData.set('userId', user.id);

																return async ({ update }) => {
																	showToast.success(`User ${user.name} deleted`, {
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
				{:else if $activeTab === 'PocketBase Settings [read-only]'}
					<div class="alert bg-blue-300">
						<IconInfoCircle size={24} class="text-blue-400" />
						<span>
							You can edit these settings in PocketBase.
							<a href={`${data.adminData.settings.meta.appUrl}/_/#/settings`} class="link"
								>Click here</a
							> to go to PB configuration panel.
						</span>
					</div>
					<!-- Meta -->
					<div class="collapse collapse-arrow border border-base-300 bg-base-200">
						<input type="checkbox" />
						<div class="collapse-title text-xl font-medium">Meta</div>
						<div class="collapse-content">
							<div class="overflow-x-auto">
								<div>
									<label for="appName" class="label">
										<span class="label-text">Application Name</span>
									</label>
									<input
										class="input input-bordered w-full"
										disabled
										placeholder="-"
										value={data.adminData.settings.meta.appName}
									/>
								</div>

								<div>
									<label for="appUrl" class="label">
										<span class="label-text">Application URL</span>
									</label>
									<input
										class="input input-bordered w-full"
										disabled
										placeholder="-"
										value={data.adminData.settings.meta.appUrl}
									/>
								</div>

								<div>
									<label for="senderName" class="label">
										<span class="label-text">Sender Name</span>
									</label>
									<input
										class="input input-bordered w-full"
										disabled
										placeholder="-"
										value={data.adminData.settings.meta.senderName}
									/>
								</div>

								<div>
									<label for="senderAddress" class="label">
										<span class="label-text">Sender Address</span>
									</label>
									<input
										class="input input-bordered w-full"
										disabled
										placeholder="-"
										value={data.adminData.settings.meta.senderAddress}
									/>
								</div>
							</div>
						</div>
					</div>
					<!-- SMTP -->
					<div class="collapse collapse-arrow border border-base-300 bg-base-200">
						<input type="checkbox" />
						<div class="collapse-title text-xl font-medium">SMTP</div>
						<div class="collapse-content">
							<div class="overflow-x-auto">
								<div>
									<label for="smtpEnabled" class="label">
										<span class="label-text">SMTP enabled?</span>
									</label>
									<input
										type="checkbox"
										name="smtpEnabled"
										checked={data.adminData.settings.smtp.enabled}
										class="checkbox-accent checkbox ml-4"
										disabled
										placeholder="-"
									/>
								</div>

								<div>
									<label for="smtpHost" class="label">
										<span class="label-text">Host</span>
									</label>
									<input
										type="text"
										name="smtpHost"
										value={data.adminData.settings.smtp.host}
										class="input input-bordered w-full"
										disabled
										placeholder="-"
									/>
								</div>

								<div>
									<label for="smtpPort" class="label">
										<span class="label-text">Port</span>
									</label>
									<input
										type="text"
										name="smtpPort"
										value={data.adminData.settings.smtp.port}
										class="input input-bordered w-full"
										disabled
										placeholder="-"
									/>
								</div>
								<div>
									<label for="smtpUsername" class="label">
										<span class="label-text">Username</span>
									</label>
									<input
										type="text"
										name="smtpUsername"
										value={data.adminData.settings.smtp.username}
										class="input input-bordered w-full"
										placeholder="-"
										disabled
									/>
								</div>
								<div>
									<label for="smtpPassword" class="label">
										<span class="label-text">Password</span>
									</label>
									<input
										type="password"
										name="smtpPassword"
										value={data.adminData.settings.smtp.password}
										class="input input-bordered w-full"
										disabled
										placeholder="-"
									/>
								</div>
								<div>
									<label for="smtpAuthMethod" class="label">
										<span class="label-text">Authentication Method</span>
									</label>
									<select
										name="smtpAuthMethod"
										class="select select-bordered w-full"
										value={data.adminData.settings.smtp.authMethod}
										disabled
										placeholder="-"
									>
									</select>
								</div>
								<div>
									<label for="smtpTls" class="label">
										<span class="label-text">TLS</span>
									</label>
									<input
										type="checkbox"
										name="smtpTls"
										checked={data.adminData.settings.smtp.tls}
										class="checkbox-accent checkbox ml-4"
										disabled
										placeholder="-"
									/>
								</div>
								<div>
									<label for="smtpLocalName" class="label">
										<span class="label-text">Local Name</span>
									</label>
									<input
										type="text"
										name="smtpLocalName"
										value={data.adminData.settings.smtp.localName}
										class="input input-bordered w-full"
										disabled
										placeholder="-"
									/>
								</div>
							</div>
						</div>
					</div>
					<!-- S3 -->
					<div class="collapse collapse-arrow border border-base-300 bg-base-200">
						<input type="checkbox" />
						<div class="collapse-title text-xl font-medium">S3 Storage</div>
						<div class="collapse-content">
							<div class="overflow-x-auto">
								<div>
									<label for="s3StorageEnabled" class="label">
										<span class="label-text">S3 enabled?</span>
									</label>
									<input
										type="checkbox"
										name="s3StorageEnabled"
										checked={data.adminData.settings.s3.enabled}
										class="checkbox-accent checkbox ml-4"
										disabled
										placeholder="-"
									/>
								</div>
								<div>
									<label for="s3StorageBucket" class="label">
										<span class="label-text">Bucket Name</span>
									</label>
									<input
										type="text"
										name="s3StorageBucket"
										value={data.adminData.settings.s3.bucket}
										class="input input-bordered w-full"
										disabled
										placeholder="-"
									/>
								</div>
								<div>
									<label for="s3StorageRegion" class="label">
										<span class="label-text">Region</span>
									</label>
									<input
										type="text"
										name="s3StorageRegion"
										value={data.adminData.settings.s3.region}
										class="input input-bordered w-full"
										disabled
										placeholder="-"
									/>
								</div>
								<div>
									<label for="s3StorageEndpoint" class="label">
										<span class="label-text">Endpoint</span>
									</label>
									<input
										type="text"
										name="s3StorageEndpoint"
										value={data.adminData.settings.s3.endpoint}
										class="input input-bordered w-full"
										disabled
										placeholder="-"
									/>
								</div>
								<div>
									<label for="s3StorageAccessKey" class="label">
										<span class="label-text">Access Key</span>
									</label>
									<input
										type="text"
										name="s3StorageAccessKey"
										value={data.adminData.settings.s3.accessKey}
										class="input input-bordered w-full"
										disabled
										placeholder="-"
									/>
								</div>
								<div>
									<label for="s3StorageSecret" class="label">
										<span class="label-text">Secret</span>
									</label>
									<input
										type="text"
										name="s3StorageSecret"
										value={data.adminData.settings.s3.secret}
										class="input input-bordered w-full"
										disabled
										placeholder="-"
									/>
								</div>
								<div>
									<label for="s3StorageForcePathStyle" class="label">
										<span class="label-text">Force Path Style</span>
									</label>
									<input
										type="checkbox"
										name="s3StorageForcePathStyle"
										checked={data.adminData.settings.s3.forcePathStyle}
										class="checkbox-accent checkbox ml-4"
										disabled
										placeholder="-"
									/>
								</div>
							</div>
						</div>
					</div>
					<!-- Backups -->
					<div class="collapse collapse-arrow border border-base-300 bg-base-200">
						<input type="checkbox" />
						<div class="collapse-title text-xl font-medium">Backups</div>
						<div class="collapse-content">
							<div class="overflow-x-auto">
								<div>
									<label for="backupsCron" class="label">
										<span class="label-text">Cron</span>
									</label>
									<input
										type="text"
										name="backupsCron"
										value={data.adminData.settings.backups.cron}
										class="input input-bordered w-full"
										disabled
										placeholder="-"
									/>
								</div>
								<div>
									<label for="backupsCronMaxKeep" class="label">
										<span class="label-text">Cron Max Keep</span>
									</label>
									<input
										type="number"
										name="backupsCronMaxKeep"
										value={data.adminData.settings.backups.cronMaxKeep}
										class="input input-bordered w-full"
										disabled
										placeholder="-"
									/>
								</div>
								<div class="m-2 rounded-md border border-base-300 bg-base-200 p-2">
									<div>
										<label for="backupsS3Enabled" class="label">
											<span class="label-text">S3 Enabled?</span>
										</label>
										<input
											type="checkbox"
											name="backupsS3Enabled"
											checked={data.adminData.settings.backups.s3.enabled}
											class="checkbox-accent checkbox ml-4"
											disabled
											placeholder="-"
										/>
									</div>
									<div>
										<label for="backupsS3Bucket" class="label">
											<span class="label-text">S3 Bucket</span>
										</label>
										<input
											type="text"
											name="backupsS3Bucket"
											value={data.adminData.settings.backups.s3.bucket}
											class="input input-bordered w-full"
											disabled
											placeholder="-"
										/>
									</div>
									<div>
										<label for="backupsS3Region" class="label">
											<span class="label-text">S3 Region</span>
										</label>
										<input
											type="text"
											name="backupsS3Region"
											value={data.adminData.settings.backups.s3.region}
											class="input input-bordered w-full"
											disabled
											placeholder="-"
										/>
									</div>
									<div>
										<label for="backupsS3Endpoint" class="label">
											<span class="label-text">S3 Endpoint</span>
										</label>
										<input
											type="text"
											name="backupsS3Endpoint"
											value={data.adminData.settings.backups.s3.endpoint}
											class="input input-bordered w-full"
											disabled
											placeholder="-"
										/>
									</div>
									<div>
										<label for="backupsS3AccessKey" class="label">
											<span class="label-text">S3 Access Key</span>
										</label>
										<input
											type="text"
											name="backupsS3AccessKey"
											value={data.adminData.settings.backups.s3.accessKey}
											class="input input-bordered w-full"
											disabled
											placeholder="-"
										/>
									</div>
									<div>
										<label for="backupsS3Secret" class="label">
											<span class="label-text">S3 Secret</span>
										</label>
										<input
											type="text"
											name="backupsS3Secret"
											value={data.adminData.settings.backups.s3.secret}
											class="input input-bordered w-full"
											disabled
											placeholder="-"
										/>
									</div>
									<div>
										<label for="backupsS3ForcePathStyle" class="label">
											<span class="label-text">S3 Force Path Style</span>
										</label>
										<input
											type="checkbox"
											name="backupsS3ForcePathStyle"
											checked={data.adminData.settings.backups.s3.forcePathStyle}
											class="checkbox-accent checkbox ml-4"
											disabled
											placeholder="-"
										/>
									</div>
								</div>
							</div>
						</div>
					</div>
					<!-- Security -->
					<div class="collapse collapse-arrow border border-base-300 bg-base-200">
						<input type="checkbox" />
						<div class="collapse-title text-xl font-medium">Security</div>
						<div class="collapse-content">
							<div class="overflow-x-auto">
								<div class="m-2 rounded-md border border-base-300 bg-base-200 p-2">
									<h3>Admin Auth Token</h3>
									<div>
										<label for="securityAdminAuthTokenSecret" class="label">
											<span class="label-text">Secret</span>
										</label>
										<input
											type="text"
											name="securityAdminAuthTokenSecret"
											value={data.adminData.settings.adminAuthToken.secret}
											class="input input-bordered w-full"
											disabled
											placeholder="-"
										/>
									</div>
									<div>
										<label for="securityAdminAuthTokenDuration" class="label">
											<span class="label-text">Duration</span>
										</label>
										<input
											type="number"
											name="securityAdminAuthTokenDuration"
											value={data.adminData.settings.adminAuthToken.duration}
											class="input input-bordered w-full"
											disabled
											placeholder="-"
										/>
									</div>
								</div>
								<div class="m-2 rounded-md border border-base-300 bg-base-200 p-2">
									<h3>Admin Password Reset Token</h3>
									<div>
										<label for="securityAdminPasswordResetTokenSecret" class="label">
											<span class="label-text">Secret</span>
										</label>
										<input
											type="text"
											name="securityAdminPasswordResetTokenSecret"
											value={data.adminData.settings.adminPasswordResetToken.secret}
											class="input input-bordered w-full"
											disabled
											placeholder="-"
										/>
										<label for="securityAdminPasswordResetTokenDuration" class="label">
											<span class="label-text">Duration</span>
										</label>
										<input
											type="number"
											name="securityAdminPasswordResetTokenDuration"
											value={data.adminData.settings.adminPasswordResetToken.duration}
											class="input input-bordered w-full"
											disabled
											placeholder="-"
										/>
									</div>
								</div>
								<div class="m-2 rounded-md border border-base-300 bg-base-200 p-2">
									<h3>Admin File Token</h3>
									<div>
										<label for="securityAdminFileTokenSecret" class="label">
											<span class="label-text">Secret</span>
										</label>
										<input
											type="text"
											name="securityAdminFileTokenSecret"
											value={data.adminData.settings.adminFileToken.secret}
											class="input input-bordered w-full"
											disabled
											placeholder="-"
										/>
									</div>

									<div>
										<label for="securityAdminFileTokenDuration" class="label">
											<span class="label-text">Duration</span>
										</label>
										<input
											type="number"
											name="securityAdminFileTokenDuration"
											value={data.adminData.settings.adminFileToken.duration}
											class="input input-bordered w-full"
											disabled
											placeholder="-"
										/>
									</div>
								</div>
								<div class="m-2 rounded-md border border-base-300 bg-base-200 p-2">
									<h3>Record Auth Token</h3>
									<div>
										<label for="securityRecordAuthTokenSecret" class="label">
											<span class="label-text">Secret</span>
										</label>
										<input
											type="text"
											name="securityRecordAuthTokenSecret"
											value={data.adminData.settings.recordAuthToken.secret}
											class="input input-bordered w-full"
											disabled
											placeholder="-"
										/>
									</div>
									<div>
										<label for="securityRecordAuthTokenDuration" class="label">
											<span class="label-text">Duration</span>
										</label>
										<input
											type="number"
											name="securityRecordAuthTokenDuration"
											value={data.adminData.settings.recordAuthToken.duration}
											class="input input-bordered w-full"
											disabled
											placeholder="-"
										/>
									</div>
								</div>
								<div class="m-2 rounded-md border border-base-300 bg-base-200 p-2">
									<h3>Record Password Reset Token</h3>
									<div>
										<label for="securityRecordPasswordResetTokenSecret" class="label">
											<span class="label-text">Secret</span>
										</label>
										<input
											type="text"
											name="securityRecordPasswordResetTokenSecret"
											value={data.adminData.settings.recordPasswordResetToken.secret}
											class="input input-bordered w-full"
											disabled
											placeholder="-"
										/>
									</div>
									<div>
										<label for="securityRecordPasswordResetTokenDuration" class="label">
											<span class="label-text">Duration</span>
										</label>
										<input
											type="number"
											name="securityRecordPasswordResetTokenDuration"
											value={data.adminData.settings.recordPasswordResetToken.duration}
											class="input input-bordered w-full"
											disabled
											placeholder="-"
										/>
									</div>
								</div>
								<div class="m-2 rounded-md border border-base-300 bg-base-200 p-2">
									<h3>Record Email Change Token</h3>
									<div>
										<label for="securityRecordEmailChangeTokenSecret" class="label">
											<span class="label-text">Secret</span>
										</label>
										<input
											type="text"
											name="securityRecordEmailChangeTokenSecret"
											value={data.adminData.settings.recordEmailChangeToken.secret}
											class="input input-bordered w-full"
											disabled
											placeholder="-"
										/>
									</div>
									<div>
										<label for="securityRecordEmailChangeTokenDuration" class="label">
											<span class="label-text">Duration</span>
										</label>
										<input
											type="number"
											name="securityRecordEmailChangeTokenDuration"
											value={data.adminData.settings.recordEmailChangeToken.duration}
											class="input input-bordered w-full"
											disabled
											placeholder="-"
										/>
									</div>
								</div>
								<div class="m-2 rounded-md border border-base-300 bg-base-200 p-2">
									<h3>Record Verification Token</h3>
									<div>
										<label for="securityRecordVerificationTokenSecret" class="label">
											<span class="label-text">Secret</span>
										</label>
										<input
											type="text"
											name="securityRecordVerificationTokenSecret"
											value={data.adminData.settings.recordVerificationToken.secret}
											class="input input-bordered w-full"
											disabled
											placeholder="-"
										/>
									</div>
									<div>
										<label for="securityRecordVerificationTokenDuration" class="label">
											<span class="label-text">Duration</span>
										</label>
										<input
											type="number"
											name="securityRecordVerificationTokenDuration"
											value={data.adminData.settings.recordVerificationToken.duration}
											class="input input-bordered w-full"
											disabled
											placeholder="-"
										/>
									</div>
								</div>
								<div class="m-2 rounded-md border border-base-300 bg-base-200 p-2">
									<h3>Record File Token</h3>
									<div>
										<label for="securityRecordFileTokenSecret" class="label">
											<span class="label-text">Secret</span>
										</label>
										<input
											type="text"
											name="securityRecordFileTokenSecret"
											value={data.adminData.settings.recordFileToken.secret}
											class="input input-bordered w-full"
											disabled
											placeholder="-"
										/>
									</div>
									<div>
										<label for="securityRecordFileTokenDuration" class="label">
											<span class="label-text">Duration</span>
										</label>
										<input
											type="number"
											name="securityRecordFileTokenDuration"
											value={data.adminData.settings.recordFileToken.duration}
											class="input input-bordered w-full"
											disabled
											placeholder="-"
										/>
									</div>
								</div>
							</div>
						</div>
					</div>
					<!-- Authentication -->
				{/if}
			{/if}
		</div>
	</div>
{/if}
