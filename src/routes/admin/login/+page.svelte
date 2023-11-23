<script lang="ts">
	import { page } from '$app/stores';
	import type { ActionData } from './$types';
	import { IconExclamationCircle } from '@tabler/icons-svelte';

	let form: ActionData;
</script>

{#if form?.incorrect || $page.status === 401}
	<div role="alert" class="alert alert-error">
		<IconExclamationCircle />
		<span> Incorrect credentials. </span>
	</div>
{/if}
<div class="flex flex-col w-full mt-16 gap-20">
	<div class="flex justify-center"><h1 class="text-2xl">Admin Login</h1></div>

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
					class="input input-bordered w-full max-w-xs"
				/>
			</div>
			<div>
				<label for="password" class="label">
					<span class="label-text">Password</span>
				</label>
				<input
					type="password"
					name="password"
					placeholder="Type here"
					class="input input-bordered w-full max-w-xs"
				/>
			</div>
			<button class="btn btn-primary">Sign in</button>
		</div>
	</form>
</div>
