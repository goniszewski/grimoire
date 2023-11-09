<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
</script>

<div class="w-full mt-24">
	<form
		method="POST"
		use:enhance={() => {
			return async ({ result }) => {
				await applyAction(result);
			};
		}}
	>
		<div class="form-control mx-auto max-w-xs gap-4">
			<div>
				<label class="label" for="username">
					<span class="label-text">Username</span>
				</label>
				<input
					type="text"
					name="username"
					placeholder="Type here"
					class="input input-bordered w-full max-w-xs"
				/>
			</div>
			<div>
				<label class="label" for="name">
					<span class="label-text">Display name</span>
				</label>
				<input
					type="text"
					name="name"
					placeholder="Type here"
					class="input input-bordered w-full max-w-xs"
				/>
			</div>
			<div>
				<label class="label" for="email">
					<span class="label-text">Email</span>
				</label>
				<input
					type="email"
					name="email"
					placeholder="Type here"
					class="input input-bordered w-full max-w-xs"
				/>
			</div>
			<div>
				<label class="label" for="password">
					<span class="label-text">Password</span>
				</label>
				<input
					type="password"
					name="password"
					placeholder="Type here"
					class="input input-bordered w-full max-w-xs"
				/>
			</div>
			<div>
				<label class="label" for="passwordConfirm">
					<span class="label-text">Repeat password</span>
				</label>
				<input
					type="password"
					name="passwordConfirm"
					placeholder="Type here"
					class="input input-bordered w-full max-w-xs"
				/>
			</div>
			<button class="btn btn-primary">Sign up</button>
		</div>
	</form>
</div>
