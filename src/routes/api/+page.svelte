<script lang="ts">
	import { onMount } from 'svelte';
	import SwaggerUI from 'swagger-ui';
	import 'swagger-ui/dist/swagger-ui.css';
	import * as spec from './api-schema.json';

	onMount(async () => {
		SwaggerUI({
			spec,
			dom_id: '#swagger-ui-container'
		});
	});
</script>

<svelte:head>
	<title>Grimoire - SwaggerUI</title>
</svelte:head>

<div id="swagger-ui-container" class="bg-gray-50 w-full rounded-lg" />
