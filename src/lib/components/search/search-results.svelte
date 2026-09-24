<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Spacer, Toolbar } from '@sveltia/ui';
  import { onDestroy, untrack } from 'svelte';

  import ItemSelector from '$lib/components/common/page-toolbar/item-selector.svelte';
  import DeleteEntriesDialog from '$lib/components/contents/shared/delete-entries-dialog.svelte';
  import AssetResults from '$lib/components/search/asset-results.svelte';
  import EntryResults from '$lib/components/search/entry-results.svelte';
  import { getListedCollections, selectedEntries } from '$lib/services/contents/collection/entries';
  import { searchMode, searchTerms } from '$lib/services/search';
  import { entrySearchResults } from '$lib/services/search/entries';
  import { env } from '$lib/services/user/env.svelte';
  import { openAuthoring } from '$lib/services/workflow/open-authoring';

  let showDeleteDialog = $state(false);

  // Reset selected entries when search terms change or component is destroyed
  $effect(() => {
    void searchTerms.current;
    untrack(() => {
      selectedEntries.current = [];
    });
  });

  onDestroy(() => {
    selectedEntries.current = [];
  });

  const deleteDisabled = $derived.by(() => {
    if (!selectedEntries.current.length) {
      return true;
    }

    return selectedEntries.current.some((entry) => {
      const collection = getListedCollections(entry)[0];

      return collection?._type !== 'entry' || collection.delete === false;
    });
  });
</script>

<div role="none" class="wrapper">
  {#if !env.isSmallScreen}
    <Toolbar variant="primary">
      <h2 role="none">{_('search_results')}</h2>
      {#if searchMode.current === 'contents' && entrySearchResults.current.length && !openAuthoring.current && !env.isMediumScreen}
        <ItemSelector
          allItems={entrySearchResults.current.map(({ entry }) => entry)}
          selectedItems={selectedEntries}
        />
      {/if}
      <Spacer flex />
      {#if searchMode.current === 'contents' && !openAuthoring.current}
        <Button
          variant="ghost"
          label={_('delete')}
          aria-label={_('delete_selected_entries', {
            values: { count: selectedEntries.current.length },
          })}
          disabled={deleteDisabled}
          onclick={() => {
            showDeleteDialog = true;
          }}
        />
      {/if}
    </Toolbar>
  {/if}
  <div role="none" class="results">
    {#if searchMode.current === 'contents'}
      <EntryResults />
    {/if}
    {#if searchMode.current === 'assets'}
      <AssetResults />
    {/if}
  </div>
</div>

<DeleteEntriesDialog bind:open={showDeleteDialog} />

<style>
  .wrapper {
    flex: auto;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    width: 100%;
    background-color: var(--sui-primary-background-color);
  }

  h2 {
    flex: none !important;
  }

  .results {
    flex: auto;
    overflow: auto;

    :global {
      & > .sui.group {
        display: contents;

        & > .inner > div {
          display: contents;
        }
      }

      h3 {
        flex: none;
        margin: 16px;
        color: var(--sui-secondary-foreground-color);
        font-size: var(--sui-font-size-large);

        & + div {
          overflow: auto;
          flex: auto;
        }

        @media (width < 768px) {
          display: none;
        }
      }
    }
  }
</style>
