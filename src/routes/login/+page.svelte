<script lang="ts">
	import { IconExclamationCircle } from '@tabler/icons-svelte';

	export let form: HTMLFormElement;
</script>

{#if form?.invalid}
	<div role="alert" class="alert alert-error">
		<IconExclamationCircle />
		<span> Incorrect credentials. </span>
	</div>
{/if}
<div class="w-full mt-24">
	<form method="POST">
		<div class="form-control mx-auto max-w-xs gap-4">
			<div>
				<label for="usernameOrEmail" class="label">
					<span class="label-text">Username / email</span>
				</label>
				<input
					type="text"
					name="usernameOrEmail"
					placeholder="Type here"
					class={`input input-bordered w-full max-w-xs ${
						form?.invalid || (form?.missing && form?.usernameOrEmail) ? 'input-error' : ''
					}`}
				/>
				{#if form?.missing && form?.usernameOrEmail}
					<p class="text-error">This field is required.</p>
				{/if}
			</div>

			<div>
				<label for="password" class="label">
					<span class="label-text">Password</span>
				</label>
				<input
					type="password"
					name="password"
					placeholder="Type here"
					class={`input input-bordered w-full max-w-xs ${
						form?.invalid || (form?.missing && form?.password) ? 'input-error' : ''
					}`}
				/>
				{#if form?.missing && form?.password}
					<p class="text-error">This field is required.</p>
				{/if}
			</div>

			<button class="btn btn-primary">Sign in</button>
		</div>
	</form>
</div>
