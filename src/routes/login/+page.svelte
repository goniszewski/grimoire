<script lang="ts">
	import type { ActionData } from './$types';

	// export let form: ActionData;
</script>

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
