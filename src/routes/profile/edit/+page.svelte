<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { IconMenu } from '@tabler/icons-svelte';
	import { currentUser, pb } from '$lib/pb';

	let showPasswordForm = false;
</script>

{#if $currentUser?.id}
	<form method="POST" class="w-full sm:w-96" use:enhance>
		<div class="form-control flex w-full gap-4">
			<div>
				<label for="name" class="label">
					<span class="label-text">Name</span>
				</label>
				<input
					type="text"
					class="input input-secondary input-bordered w-full"
					name="name"
					value={$currentUser.name}
				/>
			</div>
			<div>
				<label for="first_name" class="label">
					<span class="label-text">username (required)</span>
				</label>
				<input
					type="text"
					class="input input-secondary input-bordered w-full"
					name="username"
					value={$currentUser.username}
					required
				/>
			</div>
			<div>
				<label for="email" class="label">
					<span class="label-text">email</span>
				</label>
				<input
					type="text"
					class="input input-secondary input-bordered w-full"
					name="email"
					value={$currentUser.email}
					placeholder="none"
				/>
			</div>
			<div>
				<button
					on:click={(e) => {
						e.preventDefault();
						showPasswordForm = !showPasswordForm;
					}}
					class="btn btn-ghost"
					>{showPasswordForm ? 'Hide password form' : 'I want to change my password'}</button
				>
			</div>
			{#if showPasswordForm}
				<div>
					<label for="current_password" class="label">
						<span class="label-text">Current password</span>
					</label>
					<input
						type="password"
						class="input input-secondary input-bordered w-full"
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
						class="input input-secondary input-bordered w-full"
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
						class="input input-secondary input-bordered w-full"
						name="new_password_repeat"
						placeholder="Repeat new password"
					/>
				</div>
			{/if}
		</div>
	</form>
{:else}
	<p>Not logged in</p>
{/if}
