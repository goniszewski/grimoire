<script lang="ts">
	import { goto } from '$app/navigation';
	import { pb } from '$lib/pb';
	import type { PageData } from './$types';

	export let data: PageData;
</script>

{#if !pb.authStore.isAdmin && pb.authStore?.model}
	<p>Not logged in.</p>
{:else}
	<div class="flex flex-col w-full gap-4">
		<h1 class="text-2xl m-auto">Admin Panel</h1>
		<p class="ml-auto">Logged as <strong>{pb.authStore.model?.email}</strong></p>
		<div class="flex flex-col my-4 gap-2">
			{#if !data.adminData}
				<p>Loading...</p>
			{:else}
				<!-- Users -->
				<div class="collapse collapse-arrow border border-base-300 bg-base-200">
					<input type="checkbox" checked />
					<div class="collapse-title text-xl font-medium">Users</div>
					<div class="collapse-content">
						<div class="overflow-x-auto bg-base-100 rounded-md p-4">
							<table class="table">
								<!-- head -->
								<thead>
									<tr>
										<th class="w-1/12">ID</th>
										<th class="w-2/12">Name</th>
										<th class="w-2/12">Username</th>
										<th class="w-3/12">Email</th>
										<th class="w-1/12">Actions</th>
									</tr>
								</thead>
								<!-- body -->
								<tbody>
									{#each data.adminData.users as user}
										<tr>
											<td>{user.id}</td>
											<td>{user.name}</td>
											<td>{user.username}</td>
											<td>{user.email}</td>
											<td> </td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				</div>
				<!-- Meta -->
				<div class="collapse collapse-arrow border border-base-300 bg-base-200">
					<input type="checkbox" />
					<div class="collapse-title text-xl font-medium">Meta</div>
					<div class="collapse-content">
						<div class="overflow-x-auto">
							<form>
								<div class="form-control">
									<label for="appName" class="label">
										<span class="label-text">Application Name</span>
									</label>
									<input
										type="text"
										name="appName"
										value={data.adminData.settings.meta.appName}
										class="input input-bordered w-full"
									/>
								</div>

								<div class="form-control">
									<label for="appUrl" class="label">
										<span class="label-text">Application URL</span>
									</label>
									<input
										type="text"
										name="appUrl"
										value={data.adminData.settings.meta.appUrl}
										class="input input-bordered w-full"
									/>
								</div>

								<div class="form-control">
									<label for="senterName" class="label">
										<span class="label-text">Sender Name</span>
									</label>
									<input
										type="text"
										name="senderName"
										value={data.adminData.settings.meta.senderName}
										class="input input-bordered w-full"
									/>
								</div>
								<div class="form-control">
									<label for="senderAddress" class="label">
										<span class="label-text">Sender Address</span>
									</label>
									<input
										type="text"
										name="senderAddress"
										value={data.adminData.settings.meta.senderAddress}
										class="input input-bordered w-full"
									/>
								</div>
							</form>
						</div>
					</div>
				</div>
				<!-- SMTP -->
				<div class="collapse collapse-arrow border border-base-300 bg-base-200">
					<input type="checkbox" />
					<div class="collapse-title text-xl font-medium">SMTP</div>
					<div class="collapse-content">
						<div class="overflow-x-auto">
							<form>
								<div class="form-control">
									<label for="smtpEnabled" class="label">
										<span class="label-text">SMTP enabled?</span>
									</label>
									<input
										type="checkbox"
										name="smtpEnabled"
										checked={data.adminData.settings.smtp.enabled}
										class="checkbox checkbox-accent"
									/>
								</div>

								<div class="form-control">
									<label for="smtpHost" class="label">
										<span class="label-text">Host</span>
									</label>
									<input
										type="text"
										name="smtpHost"
										value={data.adminData.settings.smtp.host}
										class="input input-bordered w-full"
									/>
								</div>

								<div class="form-control">
									<label for="smtpPort" class="label">
										<span class="label-text">Port</span>
									</label>
									<input
										type="text"
										name="smtpPort"
										value={data.adminData.settings.smtp.port}
										class="input input-bordered w-full"
									/>
								</div>
								<div class="form-control">
									<label for="smtpUsername" class="label">
										<span class="label-text">Username</span>
									</label>
									<input
										type="text"
										name="smtpUsername"
										value={data.adminData.settings.smtp.username}
										class="input input-bordered w-full"
									/>
								</div>
								<div class="form-control">
									<label for="smtpPassword" class="label">
										<span class="label-text">Password</span>
									</label>
									<input
										type="password"
										name="smtpPassword"
										value={data.adminData.settings.smtp.password}
										class="input input-bordered w-full"
									/>
								</div>
								<div class="form-control">
									<label for="smtpAuthMethod" class="label">
										<span class="label-text">Authentication Method</span>
									</label>
									<select
										name="smtpAuthMethod"
										class="select select-bordered w-full"
										value={data.adminData.settings.smtp.authMethod}
									>
										<option value="plain">Plain</option>
										<option value="login">Login</option>
										<option value="cram-md5">Cram MD5</option>
									</select>
								</div>
								<div class="form-control">
									<label for="smtpTls" class="label">
										<span class="label-text">TLS</span>
									</label>
									<input
										type="checkbox"
										name="smtpTls"
										checked={data.adminData.settings.smtp.tls}
										class="checkbox checkbox-accent"
									/>
								</div>
								<div class="form-control">
									<label for="smtpLocalName" class="label">
										<span class="label-text">Local Name</span>
									</label>
									<input
										type="text"
										name="smtpLocalName"
										value={data.adminData.settings.smtp.localName}
										class="input input-bordered w-full"
									/>
								</div>
							</form>
						</div>
					</div>
				</div>
				<!-- S3 -->
				<div class="collapse collapse-arrow border border-base-300 bg-base-200">
					<input type="checkbox" />
					<div class="collapse-title text-xl font-medium">S3 Storage</div>
					<div class="collapse-content">
						<div class="overflow-x-auto">
							<form>
								<div class="form-control">
									<label for="s3StorageEnabled" class="label">
										<span class="label-text">S3 enabled?</span>
									</label>
									<input
										type="checkbox"
										name="s3StorageEnabled"
										checked={data.adminData.settings.s3.enabled}
										class="checkbox checkbox-accent"
									/>
								</div>
								<div class="form-control">
									<label for="s3StorageBucket" class="label">
										<span class="label-text">Bucket Name</span>
									</label>
									<input
										type="text"
										name="s3StorageBucket"
										value={data.adminData.settings.s3.bucket}
										class="input input-bordered w-full"
									/>
								</div>
								<div class="form-control">
									<label for="s3StorageRegion" class="label">
										<span class="label-text">Region</span>
									</label>
									<input
										type="text"
										name="s3StorageRegion"
										value={data.adminData.settings.s3.region}
										class="input input-bordered w-full"
									/>
								</div>
								<div class="form-control">
									<label for="s3StorageEndpoint" class="label">
										<span class="label-text">Endpoint</span>
									</label>
									<input
										type="text"
										name="s3StorageEndpoint"
										value={data.adminData.settings.s3.endpoint}
										class="input input-bordered w-full"
									/>
								</div>
								<div class="form-control">
									<label for="s3StorageAccessKey" class="label">
										<span class="label-text">Access Key</span>
									</label>
									<input
										type="text"
										name="s3StorageAccessKey"
										value={data.adminData.settings.s3.accessKey}
										class="input input-bordered w-full"
									/>
								</div>
								<div class="form-control">
									<label for="s3StorageSecret" class="label">
										<span class="label-text">Secret</span>
									</label>
									<input
										type="text"
										name="s3StorageSecret"
										value={data.adminData.settings.s3.secret}
										class="input input-bordered w-full"
									/>
								</div>
								<div class="form-control">
									<label for="s3StorageForcePathStyle" class="label">
										<span class="label-text">Force Path Style</span>
									</label>
									<input
										type="checkbox"
										name="s3StorageForcePathStyle"
										checked={data.adminData.settings.s3.forcePathStyle}
										class="checkbox checkbox-accent"
									/>
								</div>
							</form>
						</div>
					</div>
				</div>
				<!-- Backups -->
				<div class="collapse collapse-arrow border border-base-300 bg-base-200">
					<input type="checkbox" />
					<div class="collapse-title text-xl font-medium">Backups</div>
					<div class="collapse-content">
						<div class="overflow-x-auto">
							<form>
								<div class="form-control">
									<label for="backupsCron" class="label">
										<span class="label-text">Cron</span>
									</label>
									<input
										type="text"
										name="backupsCron"
										value={data.adminData.settings.backups.cron}
										class="input input-bordered w-full"
									/>
								</div>
								<div class="form-control">
									<label for="backupsCronMaxKeep" class="label">
										<span class="label-text">Cron Max Keep</span>
									</label>
									<input
										type="number"
										name="backupsCronMaxKeep"
										value={data.adminData.settings.backups.cronMaxKeep}
										class="input input-bordered w-full"
									/>
								</div>
								<div class="p-2 m-2 border border-base-300 rounded-md bg-base-200">
									<div class="form-control">
										<label for="backupsS3Enabled" class="label">
											<span class="label-text">S3 Enabled?</span>
										</label>
										<input
											type="checkbox"
											name="backupsS3Enabled"
											checked={data.adminData.settings.backups.s3.enabled}
											class="checkbox checkbox-accent"
										/>
									</div>
									<div class="form-control">
										<label for="backupsS3Bucket" class="label">
											<span class="label-text">S3 Bucket</span>
										</label>
										<input
											type="text"
											name="backupsS3Bucket"
											value={data.adminData.settings.backups.s3.bucket}
											class="input input-bordered w-full"
										/>
									</div>
									<div class="form-control">
										<label for="backupsS3Region" class="label">
											<span class="label-text">S3 Region</span>
										</label>
										<input
											type="text"
											name="backupsS3Region"
											value={data.adminData.settings.backups.s3.region}
											class="input input-bordered w-full"
										/>
									</div>
									<div class="form-control">
										<label for="backupsS3Endpoint" class="label">
											<span class="label-text">S3 Endpoint</span>
										</label>
										<input
											type="text"
											name="backupsS3Endpoint"
											value={data.adminData.settings.backups.s3.endpoint}
											class="input input-bordered w-full"
										/>
									</div>
									<div class="form-control">
										<label for="backupsS3AccessKey" class="label">
											<span class="label-text">S3 Access Key</span>
										</label>
										<input
											type="text"
											name="backupsS3AccessKey"
											value={data.adminData.settings.backups.s3.accessKey}
											class="input input-bordered w-full"
										/>
									</div>
									<div class="form-control">
										<label for="backupsS3Secret" class="label">
											<span class="label-text">S3 Secret</span>
										</label>
										<input
											type="text"
											name="backupsS3Secret"
											value={data.adminData.settings.backups.s3.secret}
											class="input input-bordered w-full"
										/>
									</div>
									<div class="form-control">
										<label for="backupsS3ForcePathStyle" class="label">
											<span class="label-text">S3 Force Path Style</span>
										</label>
										<input
											type="checkbox"
											name="backupsS3ForcePathStyle"
											checked={data.adminData.settings.backups.s3.forcePathStyle}
											class="checkbox checkbox-accent"
										/>
									</div>
								</div>
							</form>
						</div>
					</div>
				</div>
				<!-- Security -->
				<div class="collapse collapse-arrow border border-base-300 bg-base-200">
					<input type="checkbox" />
					<div class="collapse-title text-xl font-medium">Security</div>
					<div class="collapse-content">
						<div class="overflow-x-auto">
							<form>
								<div class="p-2 m-2 border border-base-300 rounded-md bg-base-200">
									<h3>Admin Auth Token</h3>
									<div class="form-control">
										<label for="securityAdminAuthTokenSecret" class="label">
											<span class="label-text">Secret</span>
										</label>
										<input
											type="text"
											name="securityAdminAuthTokenSecret"
											value={data.adminData.settings.adminAuthToken.secret}
											class="input input-bordered w-full"
										/>
									</div>
									<div class="form-control">
										<label for="securityAdminAuthTokenDuration" class="label">
											<span class="label-text">Duration</span>
										</label>
										<input
											type="number"
											name="securityAdminAuthTokenDuration"
											value={data.adminData.settings.adminAuthToken.duration}
											class="input input-bordered w-full"
										/>
									</div>
								</div>
								<div class="p-2 m-2 border border-base-300 rounded-md bg-base-200">
									<h3>Admin Password Reset Token</h3>
									<div class="form-control">
										<label for="securityAdminPasswordResetTokenSecret" class="label">
											<span class="label-text">Secret</span>
										</label>
										<input
											type="text"
											name="securityAdminPasswordResetTokenSecret"
											value={data.adminData.settings.adminPasswordResetToken.secret}
											class="input input-bordered w-full"
										/>
										<label for="securityAdminPasswordResetTokenDuration" class="label">
											<span class="label-text">Duration</span>
										</label>
										<input
											type="number"
											name="securityAdminPasswordResetTokenDuration"
											value={data.adminData.settings.adminPasswordResetToken.duration}
											class="input input-bordered w-full"
										/>
									</div>
								</div>
								<div class="p-2 m-2 border border-base-300 rounded-md bg-base-200">
									<h3>Admin File Token</h3>
									<div class="form-control">
										<label for="securityAdminFileTokenSecret" class="label">
											<span class="label-text">Secret</span>
										</label>
										<input
											type="text"
											name="securityAdminFileTokenSecret"
											value={data.adminData.settings.adminFileToken.secret}
											class="input input-bordered w-full"
										/>
									</div>

									<div class="form-control">
										<label for="securityAdminFileTokenDuration" class="label">
											<span class="label-text">Duration</span>
										</label>
										<input
											type="number"
											name="securityAdminFileTokenDuration"
											value={data.adminData.settings.adminFileToken.duration}
											class="input input-bordered w-full"
										/>
									</div>
								</div>
								<div class="p-2 m-2 border border-base-300 rounded-md bg-base-200">
									<h3>Record Auth Token</h3>
									<div class="form-control">
										<label for="securityRecordAuthTokenSecret" class="label">
											<span class="label-text">Secret</span>
										</label>
										<input
											type="text"
											name="securityRecordAuthTokenSecret"
											value={data.adminData.settings.recordAuthToken.secret}
											class="input input-bordered w-full"
										/>
									</div>
									<div class="form-control">
										<label for="securityRecordAuthTokenDuration" class="label">
											<span class="label-text">Duration</span>
										</label>
										<input
											type="number"
											name="securityRecordAuthTokenDuration"
											value={data.adminData.settings.recordAuthToken.duration}
											class="input input-bordered w-full"
										/>
									</div>
								</div>
								<div class="p-2 m-2 border border-base-300 rounded-md bg-base-200">
									<h3>Record Password Reset Token</h3>
									<div class="form-control">
										<label for="securityRecordPasswordResetTokenSecret" class="label">
											<span class="label-text">Secret</span>
										</label>
										<input
											type="text"
											name="securityRecordPasswordResetTokenSecret"
											value={data.adminData.settings.recordPasswordResetToken.secret}
											class="input input-bordered w-full"
										/>
									</div>
									<div class="form-control">
										<label for="securityRecordPasswordResetTokenDuration" class="label">
											<span class="label-text">Duration</span>
										</label>
										<input
											type="number"
											name="securityRecordPasswordResetTokenDuration"
											value={data.adminData.settings.recordPasswordResetToken.duration}
											class="input input-bordered w-full"
										/>
									</div>
								</div>
								<div class="p-2 m-2 border border-base-300 rounded-md bg-base-200">
									<h3>Record Email Change Token</h3>
									<div class="form-control">
										<label for="securityRecordEmailChangeTokenSecret" class="label">
											<span class="label-text">Secret</span>
										</label>
										<input
											type="text"
											name="securityRecordEmailChangeTokenSecret"
											value={data.adminData.settings.recordEmailChangeToken.secret}
											class="input input-bordered w-full"
										/>
									</div>
									<div class="form-control">
										<label for="securityRecordEmailChangeTokenDuration" class="label">
											<span class="label-text">Duration</span>
										</label>
										<input
											type="number"
											name="securityRecordEmailChangeTokenDuration"
											value={data.adminData.settings.recordEmailChangeToken.duration}
											class="input input-bordered w-full"
										/>
									</div>
								</div>
								<div class="p-2 m-2 border border-base-300 rounded-md bg-base-200">
									<h3>Record Verification Token</h3>
									<div class="form-control">
										<label for="securityRecordVerificationTokenSecret" class="label">
											<span class="label-text">Secret</span>
										</label>
										<input
											type="text"
											name="securityRecordVerificationTokenSecret"
											value={data.adminData.settings.recordVerificationToken.secret}
											class="input input-bordered w-full"
										/>
									</div>
									<div class="form-control">
										<label for="securityRecordVerificationTokenDuration" class="label">
											<span class="label-text">Duration</span>
										</label>
										<input
											type="number"
											name="securityRecordVerificationTokenDuration"
											value={data.adminData.settings.recordVerificationToken.duration}
											class="input input-bordered w-full"
										/>
									</div>
								</div>
								<div class="p-2 m-2 border border-base-300 rounded-md bg-base-200">
									<h3>Record File Token</h3>
									<div class="form-control">
										<label for="securityRecordFileTokenSecret" class="label">
											<span class="label-text">Secret</span>
										</label>
										<input
											type="text"
											name="securityRecordFileTokenSecret"
											value={data.adminData.settings.recordFileToken.secret}
											class="input input-bordered w-full"
										/>
									</div>
									<div class="form-control">
										<label for="securityRecordFileTokenDuration" class="label">
											<span class="label-text">Duration</span>
										</label>
										<input
											type="number"
											name="securityRecordFileTokenDuration"
											value={data.adminData.settings.recordFileToken.duration}
											class="input input-bordered w-full"
										/>
									</div>
								</div>
							</form>
						</div>
					</div>
				</div>
				<!-- Auth -->
			{/if}
		</div>
	</div>
{/if}
