<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { showToast } from '$lib/utils/show-toast';

	// export let form: ActionData;
</script>

<div class="flex flex-col w-full mt-16 gap-20">
	<div class="flex justify-center"><h1 class="text-2xl">Admin Login</h1></div>
	<form
		method="POST"
		use:enhance={() =>
			({ update, result }) => {
				if (result.type === 'success') {
					showToast.success('Succesfully logged in', {
						position: 'bottom-center'
					});
					update();
					window.location.href = '/admin';

					// goto('/admin');
				}
			}}
	>
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
