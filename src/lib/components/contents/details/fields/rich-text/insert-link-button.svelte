<script>
  import { LinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
  import { $getNearestNodeOfType as getNearestNodeOfType } from '@lexical/utils';
  import { _ } from '@sveltia/i18n';
  import { Button, Dialog, Icon, SearchBar, TextInput } from '@sveltia/ui';
  import { isMac, matchesShortcuts } from '@sveltia/utils/events';
  import {
    COMMAND_PRIORITY_NORMAL,
    $createRangeSelection as createRangeSelection,
    $createTextNode as createTextNode,
    $getPreviousSelection as getPreviousSelection,
    $getSelection as getSelection,
    $getTextContent as getTextContent,
    $insertNodes as insertNodes,
    $isRangeSelection as isRangeSelection,
    KEY_DOWN_COMMAND,
    $setSelection as setSelection,
  } from 'lexical';
  import { getContext } from 'svelte';

  import { allEntries } from '$lib/services/contents';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { getInitialLinkState, searchInternalEntries } from '$lib/services/contents/entry/link';
  import { mergeUnpublishedEntries, unpublishedEntries } from '$lib/services/workflow';

  /**
   * @import { TextEditorStore } from '@sveltia/ui';
   */

  const id = $props.id();

  /**
   * Button type.
   */
  const type = 'link';

  /** @type {TextEditorStore} */
  const editorStore = getContext('editorStore');
  const selectionTypeMatches = $derived(editorStore.selection.inlineTypes.includes(type));

  const entryDraft = getEntryDraftContext();
  const currentLocale = $derived(entryDraft?.current?.currentLocale || '_default');
  const allAvailableEntries = $derived(
    mergeUnpublishedEntries(allEntries.current, unpublishedEntries.current),
  );

  let openDialog = $state(false);
  /** @type {'create' | 'update' | 'remove'} */
  let dialogMode = $state('create');
  let hasAnchor = $state(false);
  let anchorURL = $state('');
  let anchorText = $state('');
  let searchQuery = $state('');

  const searchResults = $derived(
    searchInternalEntries({
      entries: allAvailableEntries,
      query: searchQuery,
      locale: currentLocale,
      maxResults: 10,
    }),
  );

  /**
   * Select a search result and apply its URL (and title if no anchor text).
   * @param {{ id: string, title: string, url: string }} result Result item.
   */
  const selectResult = (result) => {
    anchorURL = result.url;

    if (!hasAnchor && !anchorText.trim()) {
      anchorText = result.title;
    }
  };

  /**
   * Create a new link by showing a dialog to accept a URL and optionally text.
   * If selected text is not an HTTP URL, use it in the internal search and propose the link.
   */
  const createLink = () => {
    editorStore.editor?.getEditorState().read(() => {
      const textContent = getTextContent().trim();

      const initial = getInitialLinkState({
        textContent,
        entries: allAvailableEntries,
        locale: currentLocale,
      });

      hasAnchor = !!textContent;
      anchorURL = initial.url;
      searchQuery = initial.query;
      anchorText = hasAnchor ? textContent : '';
      dialogMode = 'create';
      openDialog = true;
    });
  };

  /**
   * Remove an existing link.
   */
  const removeLink = () => {
    editorStore.editor?.dispatchCommand(TOGGLE_LINK_COMMAND, null);
  };

  /**
   * Update an existing link.
   */
  const updateLink = () => {
    editorStore.editor?.getEditorState().read(() => {
      const _selection = getSelection();

      if (isRangeSelection(_selection)) {
        const anchor = _selection.anchor.getNode();
        const parent = anchor instanceof LinkNode ? anchor : getNearestNodeOfType(anchor, LinkNode);
        const url = parent?.getURL();

        if (url) {
          hasAnchor = true;
          anchorURL = url;
          searchQuery = '';
          dialogMode = 'update';
          openDialog = true;

          return;
        }
      }

      removeLink();
    });
  };

  /**
   * Handle `click` event fired on the Link button. If a link is selected, update it. Otherwise,
   * create a new link.
   */
  const onButtonClick = () => {
    if (selectionTypeMatches) {
      updateLink();
    } else {
      createLink();
    }
  };

  /**
   * Handle `keydown` event fired on the input fields on the dialog.
   * @param {KeyboardEvent} event `keydown` event.
   */
  const onInputKeyDown = (event) => {
    if (matchesShortcuts(event, 'Enter') && anchorURL) {
      openDialog = false;
    }
  };

  /**
   * Handle `keydown` event fired on the search input.
   * @param {KeyboardEvent} event `keydown` event.
   */
  const onSearchKeyDown = (event) => {
    if (matchesShortcuts(event, 'Enter')) {
      if (searchResults.length > 0 && !anchorURL) {
        selectResult(searchResults[0]);
      } else if (anchorURL) {
        openDialog = false;
      }
    }
  };

  /**
   * Move focus back to the editor.
   * @param {import('lexical').LexicalEditor} editor Editor instance.
   * @returns {Promise<void>}
   */
  const focusEditor = async (editor) =>
    new Promise((resolve) => {
      editor.focus(() => {
        resolve(undefined);
      });
    });

  /**
   * Handle `close` event fired on the dialog. Insert a link with the given URL and optionally text.
   * @param {CustomEvent} event `close` event.
   */
  const onDialogClose = async (event) => {
    if (event.detail.returnValue !== 'cancel' && dialogMode !== 'remove') {
      if (!editorStore.editor) {
        return;
      }

      await new Promise((resolve) => {
        editorStore.editor?.update(async () => {
          let _selection = getSelection() ?? getPreviousSelection()?.clone();

          if (!isRangeSelection(_selection)) {
            _selection = createRangeSelection();
          }

          if (!hasAnchor) {
            anchorText = anchorText.trim();
            anchorText ||= anchorURL;
            insertNodes([createTextNode(anchorText)]);
          }

          setSelection(_selection);
          resolve(undefined);
        });
      });

      await focusEditor(editorStore.editor);
      editorStore.editor.dispatchCommand(TOGGLE_LINK_COMMAND, anchorURL);
    } else if (editorStore.editor) {
      await focusEditor(editorStore.editor);
    }

    anchorURL = '';
    anchorText = '';
    searchQuery = '';
  };

  /**
   * Open the dialog with a keyboard shortcut: Accel+K.
   */
  const _registerCommand = () => {
    editorStore.editor?.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        if (matchesShortcuts(event, isMac() ? 'Meta+K' : 'Ctrl+K')) {
          event.preventDefault();
          onButtonClick();
        }

        return false;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  };

  $effect(() => {
    if (editorStore.editor) {
      _registerCommand();
    }
  });
</script>

<Button
  iconic
  aria-label={_('_sui.text_editor.link')}
  aria-controls={`${editorStore.editorId}-lexical-root`}
  disabled={!editorStore.useRichText}
  pressed={selectionTypeMatches}
  onclick={() => {
    onButtonClick();
  }}
>
  {#snippet startIcon()}
    <Icon name="link" />
  {/snippet}
</Button>

<Dialog
  title={dialogMode === 'create'
    ? _('_sui.text_editor.insert_link')
    : _('_sui.text_editor.update_link')}
  bind:open={openDialog}
  okDisabled={!anchorURL}
  okLabel={dialogMode === 'create' ? _('_sui.insert') : _('_sui.update')}
  restoreFocus={false}
  onClose={(event) => {
    onDialogClose(event);
  }}
>
  <div class="link-dialog-content">
    <div role="none" class="field-row">
      <label for="{id}-url">{_('_sui.text_editor.url')}</label>
      <TextInput
        dir="ltr"
        id="{id}-url"
        bind:value={anchorURL}
        flex
        aria-label={_('_sui.text_editor.url')}
        onkeydown={(event) => {
          onInputKeyDown(event);
        }}
      />
    </div>

    {#if !hasAnchor}
      <div role="none" class="field-row">
        <label for="{id}-text">{_('_sui.text_editor.text')}</label>
        <TextInput
          dir="auto"
          id="{id}-text"
          bind:value={anchorText}
          flex
          aria-label={_('_sui.text_editor.text')}
          onkeydown={(event) => {
            onInputKeyDown(event);
          }}
        />
      </div>
    {/if}

    <div role="none" class="search-section">
      <label for="{id}-search">{_('search_placeholder_contents') || 'Rechercher un article'}</label>
      <SearchBar
        dir="auto"
        id="{id}-search"
        bind:value={searchQuery}
        flex
        placeholder={_('search_placeholder_contents') || 'Rechercher un article existant…'}
        onkeydown={(event) => {
          onSearchKeyDown(event);
        }}
      />

      {#if searchResults.length > 0}
        <div
          role="listbox"
          class="results-list"
          aria-label={_('search_results') || 'Résultats de recherche'}
        >
          {#each searchResults as result (result.id)}
            <button
              type="button"
              role="option"
              class="result-item"
              class:selected={anchorURL === result.url}
              aria-selected={anchorURL === result.url}
              onclick={() => selectResult(result)}
              ondblclick={() => {
                selectResult(result);
                openDialog = false;
              }}
            >
              <div class="result-main">
                <span class="result-title">{result.title}</span>
                {#if result.collectionLabel}
                  <span class="result-badge">{result.collectionLabel}</span>
                {/if}
              </div>
              <div class="result-meta">
                <code class="result-url">{result.url}</code>
                {#if result.date}
                  <span class="result-date">{result.date}</span>
                {/if}
              </div>
            </button>
          {/each}
        </div>
      {:else if searchQuery.trim()}
        <p class="empty-results">
          {_('empty_search_results') || 'Aucun article correspondant trouvé'}
        </p>
      {/if}
    </div>
  </div>

  {#snippet footerExtra()}
    {#if dialogMode !== 'create'}
      <Button
        variant="secondary"
        label={_('_sui.remove')}
        onclick={() => {
          removeLink();
          dialogMode = 'remove';
          openDialog = false;
        }}
      />
    {/if}
  {/snippet}
</Dialog>

<style>
  .link-dialog-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 320px;
    max-width: 520px;
  }

  .field-row {
    display: flex;
    flex-direction: column;
    gap: 4px;

    label {
      font-size: var(--sui-font-size-small);
      font-weight: 500;
      color: var(--sui-secondary-foreground-color);
    }
  }

  .search-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
    padding-top: 12px;
    border-top: 1px solid var(--sui-secondary-border-color);

    label {
      font-size: var(--sui-font-size-small);
      font-weight: 500;
      color: var(--sui-secondary-foreground-color);
    }
  }

  .results-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 200px;
    overflow-y: auto;
    padding: 4px;
    background-color: var(--sui-secondary-background-color);
    border: 1px solid var(--sui-secondary-border-color);
    border-radius: var(--sui-textbox-border-radius);
  }

  .result-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 10px;
    text-align: start;
    background: transparent;
    border: 1px solid transparent;
    border-radius: calc(var(--sui-textbox-border-radius) - 2px);
    cursor: pointer;
    transition:
      background-color 100ms ease,
      border-color 100ms ease;

    &:hover {
      background-color: var(--sui-hover-background-color);
    }

    &.selected {
      background-color: var(--sui-selected-background-color);
      border-color: var(--sui-primary-accent-color);
    }
  }

  .result-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .result-title {
    font-size: var(--sui-font-size-default);
    font-weight: 500;
    color: var(--sui-primary-foreground-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .result-badge {
    font-size: var(--sui-font-size-x-small);
    padding: 2px 6px;
    border-radius: 4px;
    background-color: var(--sui-tertiary-background-color);
    color: var(--sui-secondary-foreground-color);
    white-space: nowrap;
  }

  .result-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .result-url {
    font-size: var(--sui-font-size-x-small);
    color: var(--sui-tertiary-foreground-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .result-date {
    font-size: var(--sui-font-size-x-small);
    color: var(--sui-tertiary-foreground-color);
    white-space: nowrap;
  }

  .empty-results {
    font-size: var(--sui-font-size-small);
    color: var(--sui-tertiary-foreground-color);
    text-align: center;
    padding: 8px 0;
    margin: 0;
  }
</style>
