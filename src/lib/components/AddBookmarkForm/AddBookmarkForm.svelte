<script lang="ts">
	import { debounce } from 'lodash';

	export let metadata = {};
	export let error = '';

	const onGetMetadata = debounce(
		async (event: Event) => {
			const validateUrlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
			const target = event.target as HTMLButtonElement;
			const url = target.value;

			error = '';
			if (!url.match(validateUrlRegex)) {
				error = 'Invalid URL';

				return;
			}

			fetch(`/api/fetch-metadata`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ url })
			})
				.then((res) => res.json())
				.then((data) => {
					metadata = data?.metadata;
				});
		},
		500,
		{
			leading: false,
			trailing: true,
			maxWait: 1000
		}
	);
</script>

<form on:submit|preventDefault={onGetMetadata}>
	<div class="w-full">
		<div class="form-control flex w-full">
			{#if error}
				<div class="alert alert-error">{error}</div>
			{/if}
			<input
				type="text"
				placeholder="Paste link here..."
				class="input input-bordered w-full"
				name="url"
				on:input={onGetMetadata}
			/>
			<button class="btn btn-primary">Add</button>
		</div>
	</div>
</form>

{#if metadata}
	<pre>{JSON.stringify(metadata, null, 2)}</pre>
{/if}
