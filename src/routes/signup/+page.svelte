<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import { page } from '$app/stores';

	export let form: HTMLFormElement;
</script>

<div class="w-full mt-24">
	{#if $page.data.signupDisabled}
		<div class="flex flex-col items-center justify-center gap-4 p-4 mx-auto">
			<h1 class="text-2xl font-bold">Sign up</h1>
			<p class="text-gray-500">
				Sign up is currently disabled. Please contact the administrator if you want to sign up.
			</p>
		</div>
	{:else}
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
						<span class="label-text-alt"> (required)</span>
					</label>
					<input
						type="text"
						name="username"
						placeholder="Type here"
						class={`input input-bordered w-full max-w-xs ${
							form?.missing && form?.username ? 'input-error' : ''
						}`}
					/>
					{#if (form?.missing && form?.username) || (form?.invalid && form?.username)}
						<p class="text-error">
							{form?.missing ? 'This field is required.' : form?.username?.message}
						</p>
					{/if}
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
						<span class="label-text-alt"> (required)</span>
					</label>
					<input
						type="password"
						name="password"
						placeholder="Type here"
						class={`input input-bordered w-full max-w-xs ${
							(form?.missing && form?.password) || (form?.invalid && form?.password)
								? 'input-error'
								: ''
						}`}
					/>
					{#if (form?.missing && form?.password) || (form?.invalid && form?.password)}
						<p class="text-error">
							{form?.missing ? 'This field is required.' : form?.password?.message}
						</p>
					{/if}
				</div>
				<div>
					<label class="label" for="passwordConfirm">
						<span class="label-text">Repeat password</span>
						<span class="label-text-alt"> (required)</span>
					</label>
					<input
						type="password"
						name="passwordConfirm"
						placeholder="Type here"
						class={`input input-bordered w-full max-w-xs ${
							(form?.missing && form?.passwordConfirm) || (form?.invalid && form?.password)
								? 'input-error'
								: ''
						}`}
					/>
					{#if (form?.missing && form?.passwordConfirm) || (form?.invalid && (form?.passwordConfirm || form?.password))}
						<p class="text-error">
							{form?.missing
								? 'This field is required.'
								: form?.passwordConfirm?.message || form?.password?.message}
						</p>
					{/if}
				</div>
				<button class="btn btn-primary">Sign up</button>
			</div>
		</form>
	{/if}
</div>
