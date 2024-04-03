<script lang="ts">
	import { enhance } from '$app/forms';
	import { user } from '$lib/pb';
	import { showToast } from '$lib/utils/show-toast';

	let showPasswordForm = false;

	let form: HTMLFormElement;
</script>

{#if !$user.isValid && $user.model}
	<p>Not logged in</p>
{:else}
	<form
		bind:this={form}
		method="POST"
		class="w-full sm:w-96"
		use:enhance={({ formData }) => {
			if (!showPasswordForm) {
				formData.delete('current_password');
				formData.delete('new_password');
				formData.delete('new_password_repeat');
			}

			return async ({ result }) => {
				if (result.type === 'success') {
					console.log('result', result);
					showToast.success('User details updated!');
				}
			};
		}}
	>
		<div class="form-control flex w-full gap-4">
			<div>
				<label for="name" class="label">
					<span class="label-text">Name</span>
				</label>
				<input
					type="text"
					class="input input-bordered input-secondary w-full"
					name="name"
					value={$user.model?.name}
				/>
			</div>
			<div>
				<label for="first_name" class="label">
					<span class="label-text">username (required)</span>
				</label>
				<input
					type="text"
					class="input input-bordered input-secondary w-full"
					name="username"
					value={$user.model?.username}
					required
				/>
			</div>
			<div>
				<label for="email" class="label">
					<span class="label-text">email</span>
				</label>
				<input
					type="text"
					class="input input-bordered input-secondary w-full"
					name="email"
					value={$user.model?.email}
					placeholder="none"
				/>
			</div>
			<!-- <div> -->
			<button
				on:click={(e) => {
					e.preventDefault();
					showPasswordForm = !showPasswordForm;
				}}
				class="btn btn-ghost"
				>{showPasswordForm ? 'Hide password form' : 'I want to change my password'}</button
			>
			<!-- </div> -->
			{#if showPasswordForm}
				<div>
					<label for="current_password" class="label">
						<span class="label-text">Current password</span>
					</label>
					<input
						type="password"
						class="input input-bordered input-secondary w-full"
						name="current_password"
						placeholder="Password"
					/>
				</div>
				<div>
					<label for="new_password" class="label">
						<span class="label-text">New password</span>
					</label>
					<input
						type="password"
						class="input input-bordered input-secondary w-full"
						name="new_password"
						placeholder="New password"
					/>
				</div>
				<div>
					<label for="new_password_repeat" class="label">
						<span class="label-text">Repeat new password</span>
					</label>
					<input
						type="password"
						class="input input-bordered input-secondary w-full"
						name="new_password_repeat"
						placeholder="Repeat new password"
					/>
				</div>
			{/if}
			<button class="btn btn-primary">Save</button>
		</div>
	</form>
{/if}
