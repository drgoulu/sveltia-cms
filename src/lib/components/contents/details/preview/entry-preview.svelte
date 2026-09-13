<script>
  import { _ } from '@sveltia/i18n';
  import { VisibilityObserver } from '@sveltia/ui';

  import EntryPreviewIframe from '$lib/components/contents/details/preview/entry-preview-iframe.svelte';
  import FieldPreview from '$lib/components/contents/details/preview/field-preview.svelte';
  import HugoPreviewPane from '$lib/components/contents/details/preview/hugo-preview-pane.svelte';
  import { immutableLoaded, loadImmutable } from '$lib/services/api/immutable';
  import {
    customPreviewStyleRegistry,
    customPreviewTemplateRegistry,
  } from '$lib/services/api/registries';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { preparePreviewTemplateProps } from '$lib/services/contents/editor/preview-templates';
  import { shadowDraft } from '$lib/services/contents/preview/shadow-draft.svelte';
  import { getValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';

  /**
   * @import { EntryDraft, InternalLocaleCode } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {InternalLocaleCode} locale Current pane’s locale.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    /* eslint-enable prefer-const */
  } = $props();

  let useHugoLivePreview = $state(true);

  const {
    collectionName,
    fileName,
    fields = [],
  } = $derived(/** @type {EntryDraft} */ (entryDraft.current ?? {}));
  const styleURLs = $derived([...customPreviewStyleRegistry]);
  const reactComponent = $derived(customPreviewTemplateRegistry.get(fileName ?? collectionName));
  // The template receives Immutable Maps, so the props can only be built once the library is loaded
  const reactProps = $derived(
    entryDraft.current && reactComponent && immutableLoaded.current
      ? preparePreviewTemplateProps({
          entryDraft,
          draft: $state.snapshot(entryDraft.current),
          locale,
        })
      : undefined,
  );

  const valueMap = $derived(getValueMapSnapshot(entryDraft.current, locale));

  // Sync draft to Hugo shadow file whenever values change
  $effect(() => {
    if (entryDraft.current && shadowDraft.available && useHugoLivePreview && valueMap) {
      // getValueMapSnapshot tracks the proxy version reactively on every field edit
      shadowDraft.scheduleSync(entryDraft.current, locale, valueMap);
    }
  });

  $effect(() => {
    if (reactComponent) {
      loadImmutable().catch((/** @type {Error} */ error) => {
        // eslint-disable-next-line no-console
        console.error(error);
      });
    }
  });
</script>

{#snippet children()}
  {#each fields as fieldConfig (fieldConfig.name)}
    <VisibilityObserver>
      <FieldPreview
        keyPath={fieldConfig.name}
        typedKeyPath={fieldConfig.name}
        {locale}
        {fieldConfig}
      />
    </VisibilityObserver>
  {/each}
{/snippet}

{#if shadowDraft.available && useHugoLivePreview}
  <HugoPreviewPane onSwitchToStandard={() => (useHugoLivePreview = false)} />
{:else}
  {#if shadowDraft.available}
    <div class="hugo-switch-bar">
      <button
        type="button"
        class="hugo-switch-btn"
        onclick={() => (useHugoLivePreview = true)}
      >
        ⚡ Basculer vers l’aperçu Hugo en direct
      </button>
    </div>
  {/if}

  <VisibilityObserver>
    {#if reactComponent && reactProps}
      <EntryPreviewIframe {locale} {styleURLs} {reactComponent} {reactProps} />
    {:else if styleURLs.length}
      <EntryPreviewIframe {locale} {styleURLs} {children} />
    {:else}
      <div role="document" aria-label={_('content_preview')}>
        {@render children()}
      </div>
    {/if}
  </VisibilityObserver>
{/if}

<style>
  div[role='document'] {
    --entry-preview-padding-block: 8px;
    --entry-preview-padding-inline: 16px;
    padding-block: var(--entry-preview-padding-block);
    padding-inline: var(--entry-preview-padding-inline);
  }

  .hugo-switch-bar {
    padding: 6px 12px;
    background: #1e293b;
    border-bottom: 1px solid #334155;
    display: flex;
    justify-content: flex-end;
  }

  .hugo-switch-btn {
    background: #2563eb;
    color: #ffffff;
    border: none;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
  }

  .hugo-switch-btn:hover {
    background: #1d4ed8;
  }
</style>
