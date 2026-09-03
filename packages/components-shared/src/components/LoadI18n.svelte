<script lang="ts">
	// https://lingui.dev/installation#vite
	// https://lingui.dev/tutorials/javascript
	// https://lingui.dev/ref/vite-plugin

	import { stateI18nDerived } from 'state-shared';

	import { onMount, type Snippet } from 'svelte';

	import { stateUrlDerived, type Language } from 'state-shared';
	import type { MessagesMap } from 'utils-shared/i18n';

	type Props = {
		debug?: boolean;
		children: Snippet;
		messagesMap: MessagesMap;
	};

	const props: Props = $props();

	let loaded = $state(false);

	const loadMessages = (lang: Language) => {
		const messages = props.messagesMap[lang];
		if (props.debug) console.log({ messages });
		return messages;
	};

	// The URL may name any Stake locale, but a game ships catalogs for only a few. Resolve the
	// language BEFORE loading it: an unregistered one (lang=de) used to reach i18n.load() with
	// undefined messages, which threw and left a console error on every boot even though the
	// fallback then worked. Falling back up front is the same outcome, quietly.
	//
	// Social (stake.us) sessions are English-only per Stake's submission checklist, and the ACTIVE
	// locale is also what formats numbers and currency (utils-shared/amount goes through
	// stateI18n.i18n.number) — so social pins 'en' regardless of the URL lang, otherwise
	// ?social=true&lang=zh would render a stake.us wallet with Chinese number formatting.
	const resolveLang = (): Language => {
		if (stateUrlDerived.social()) return 'en';
		const lang = stateUrlDerived.lang();
		return props.messagesMap[lang] ? lang : 'en';
	};

	onMount(() => {
		const lang = resolveLang();
		try {
			stateI18nDerived.init(lang, loadMessages(lang));
		} catch (error) {
			console.error("Loading fallback locale 'en' without any messages because of error", error);
			stateI18nDerived.init('en', {});
		}
		loaded = true;
	});
</script>

{#if loaded}
	{@render props.children()}
{/if}
