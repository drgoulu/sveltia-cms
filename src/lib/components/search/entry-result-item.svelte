<script>
  import { locale as appLocale } from '@sveltia/i18n';
  import { Checkbox, GridCell, GridRow, TruncatedText } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';

  import Image from '$lib/components/assets/shared/image.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { getCollectionLabel } from '$lib/services/contents/collection';
  import {
    getListedCollections,
    selectedEntries,
    selectedEntryIdSet,
  } from '$lib/services/contents/collection/entries';
  import {
    getCollectionFileLabel,
    getCollectionFilesByEntry,
  } from '$lib/services/contents/collection/files';
  import { getEntryThumbnail } from '$lib/services/contents/entry/assets';
  import { getEntrySummary } from '$lib/services/contents/entry/summary';
  import { env } from '$lib/services/user/env.svelte';
  import { toggleListItem } from '$lib/services/utils/array';
  import { openAuthoring } from '$lib/services/workflow/open-authoring';

  /**
   * @import {
   * EntrySearchResult,
   * InternalCollection,
   * InternalCollectionFile,
   * } from '$lib/types/private';
   */

  /**
   * @typedef {object} RowArgs
   * @property {InternalCollection} collection Collection.
   * @property {InternalCollectionFile} [collectionFile] Collection file. File/singleton collection
   * only.
   */

  /**
   * @typedef {object} Props
   * @property {EntrySearchResult} result Single search result.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    result,
    /* eslint-enable prefer-const */
  } = $props();

  const { entry, locale, keyPath } = $derived(result);
  const { subPath } = $derived(entry);

  /**
   * Update the entry selection.
   * @param {boolean} selected Whether the current entry item is selected.
   */
  const updateSelection = (selected) => {
    selectedEntries.current = toggleListItem(selectedEntries.current, entry, selected);
  };
</script>

{#snippet resultRow(/** @type {RowArgs} */ { collection, collectionFile })}
  <GridRow
    onChange={(event) => {
      updateSelection(event.detail.selected);
    }}
    onclick={() => {
      goto(`/collections/${collection.name}/entries/${collectionFile?.name || subPath}`, {
        state: { highlight: { locale, keyPath } },
        transitionType: 'forwards',
      });
    }}
  >
    {#if !openAuthoring.current && !(env.isSmallScreen || env.isMediumScreen) && collection._type === 'entry'}
      <GridCell class="checkbox">
        <Checkbox
          role="none"
          tabindex="-1"
          checked={selectedEntryIdSet.current.has(entry.id)}
          onChange={({ detail: { checked } }) => {
            updateSelection(checked);
          }}
        />
      </GridCell>
    {/if}
    <GridCell class="image">
      {#if collection._type === 'entry'}
        {#await getEntryThumbnail(collection, entry) then src}
          {#if src}
            <Image {src} variant="icon" cover />
          {/if}
        {/await}
      {/if}
    </GridCell>
    <GridCell class="collection">
      {#key appLocale.current}
        <bdi>{getCollectionLabel(collection)}</bdi>
      {/key}
    </GridCell>
    <GridCell class="title">
      <div role="none" class="label">
        <TruncatedText lines={2}>
          <bdi>
            {#if collectionFile}
              {getCollectionFileLabel(collectionFile)}
            {:else}
              {#key appLocale.current}
                {@html getEntrySummary(collection, entry, {
                  useTemplate: true,
                  allowMarkdown: true,
                })}
              {/key}
            {/if}
          </bdi>
        </TruncatedText>
      </div>
    </GridCell>
  </GridRow>
{/snippet}

{#each getListedCollections(entry) as collection (collection.name)}
  {#await sleep() then}
    {#each getCollectionFilesByEntry(collection, entry) as collectionFile (collectionFile.name)}
      {#await sleep() then}
        {@render resultRow({ collection, collectionFile })}
      {/await}
    {:else}
      {@render resultRow({ collection })}
    {/each}
  {/await}
{/each}
