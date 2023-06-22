<script lang="ts">
	import { Auth } from '$lib/api/auth';
	import { applyAction, enhance } from '$app/forms';
	import { pb } from '$lib/pb';
	import type { PageData, ActionData } from './$types';
	export let form: ActionData;
</script>

<div class="w-full mt-24">
	<div class="form-control mx-auto max-w-xs gap-4">
		<form
			method="POST"
			use:enhance={() => {
				return async ({ result }) => {
					pb.authStore.loadFromCookie(document.cookie);
					await applyAction(result);
				};
			}}
		>
			<div>
				<label class="label">
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
				<label class="label">
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
		</form>
	</div>
</div>
