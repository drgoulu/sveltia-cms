<script>
  import { _ } from '@sveltia/i18n';
  import { Button, EmptyState } from '@sveltia/ui';
  import { onDestroy, untrack } from 'svelte';

  import EntryEditor from '$lib/components/contents/details/editor/entry-editor.svelte';
  import EntryPreview from '$lib/components/contents/details/preview/entry-preview.svelte';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { toggleLocale } from '$lib/services/contents/draft/update/locale';
  import { entryEditorSettings } from '$lib/services/contents/editor/settings';
  import { getLocaleLabel } from '$lib/services/contents/i18n';

  /**
   * @import { EntryEditorPane } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {string} id The wrapper element’s `id` attribute.
   * @property {{ current: ?EntryEditorPane }} thisPane This pane’s mode and locale.
   * @property {HTMLElement} [thisPaneContentArea] This pane’s content area, bound for the parent.
   * @property {HTMLElement} [thatPaneContentArea] Another pane’s content area.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    id,
    thisPane,
    thisPaneContentArea = $bindable(),
    thatPaneContentArea = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const { syncScrolling } = $derived(entryEditorSettings.current ?? {});
  const locale = $derived(thisPane.current?.locale);
  const mode = $derived(thisPane.current?.mode);
  const hasContent = $derived(!!locale && !!entryDraft.current?.currentValues[locale]);
  /* v8 ignore start -- only read for a disabled locale, which the pane always has */
  const labelOptions = $derived({
    values: { locale: locale ? (getLocaleLabel(locale) ?? locale) : '' },
  });
  /* v8 ignore stop */
  const MainContent = $derived(mode === 'preview' ? EntryPreview : EntryEditor);

  /** @type {HTMLElement | undefined} */
  let contentArea = $state();
  /** @type {MutationObserver | undefined} */
  let mutationObserver;
  /** @type {HTMLIFrameElement | null} */
  let trackedIframe = null;

<<<<<<< HEAD
  let isSyncing = false;
  /** @type {number | null} */
  let rafId = null;
=======
  /**
   * Sync the scroll position with the other edit/preview pane.
   */
  const syncScrollPosition = () => {
    window.requestAnimationFrame(() => {
      if (!syncScrolling || !contentArea || !thisPaneContentArea || !thatPaneContentArea) {
        return;
      }

      const isIframe = thisPaneContentArea !== contentArea;
      const { x, y } = isIframe ? { x: 0, y: 0 } : thisPaneContentArea.getBoundingClientRect();
      const { ownerDocument, scrollTop, scrollHeight, clientHeight } = thisPaneContentArea;
      const scrollTopMax = scrollHeight - clientHeight;
      const scrollRatio = scrollTop / scrollTopMax;

      // Find the field section in the top left corner of the content area. Use `findLast` to
      // capture the topmost element; otherwise the List field sticky headers will interfere with
      // the positioning.
      // @see https://github.com/sveltia/sveltia-cms/issues/883
      const thisElement = /** @type {HTMLElement | undefined} */ (
        ownerDocument.elementsFromPoint(x + 80, y).findLast((e) => e.matches('[data-key-path]'))
      );

      if (!thisElement) {
        // Calculate the scroll position based on the current scroll position of the this pane
        thatPaneContentArea.scrollTop = thatPaneContentArea.scrollHeight * scrollRatio;

        return;
      }

      // The element was found by that very attribute, so the key path is there
      const { keyPath } = /** @type {{ keyPath: string }} */ (thisElement.dataset);
      const { top, height } = thisElement.getBoundingClientRect();
      const ratio = (y - top) / height;

      const thatElement = /** @type {HTMLElement | undefined} */ (
        thatPaneContentArea.querySelector(`[data-key-path="${CSS.escape(keyPath)}"]`)
      );

      if (ratio < 0 || ratio > 1 || !thatElement) {
        return;
      }

      // Scroll the other pane to the corresponding element, adjusting for the current scroll
      // position and the ratio of the scroll position within the element.
      thatPaneContentArea.scrollTop = thatElement.offsetTop - y + thatElement.clientHeight * ratio;
    });
  };
>>>>>>> upstream/main

  /** @type {AddEventListenerOptions} */
  const eventOptions = { capture: true, passive: true };
  /** Counter to ignore an outdated initialization once a newer one has started. */
  let initCount = 0;

  /**
   * Find the preview iframe, which is used in the preview mode only when a custom preview
   * stylesheet or template is provided. The preview is rendered lazily once it’s visible, so the
   * iframe may not be in the DOM yet when the pane mode changes.
   * @returns {Promise<HTMLIFrameElement | null>} Iframe, if any.
   */
  const findPreviewIframe = async () => {
    for (let i = 0; i < 10; i += 1) {
      const iframe = contentArea?.querySelector('iframe.preview');

      if (iframe) {
        return /** @type {HTMLIFrameElement} */ (iframe);
      }

      // eslint-disable-next-line no-await-in-loop
      await sleep(50);
    }

    return null;
  };

  /**
   * Hide scrollbar inside an iframe document so only one vertical scrollbar is visible.
   * @param {Document | undefined | null} doc Target document.
   */
  const hideIframeScrollbar = (doc) => {
    try {
      if (doc && !doc.getElementById('sveltia-hide-scrollbar')) {
        const style = doc.createElement('style');

        style.id = 'sveltia-hide-scrollbar';
        style.textContent = `
          html, body {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
          }
          html::-webkit-scrollbar, body::-webkit-scrollbar {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
          }
        `;
        (doc.head || doc.documentElement)?.appendChild(style);
      }
    } catch {
      // Ignore potential cross-origin error
    }
  };

  /**
   * Sync the scroll position with the other edit/preview pane.
   */
  const syncScrollPosition = () => {
    if (!syncScrolling || !contentArea || !thisPaneContentArea || !thatPaneContentArea) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = thisPaneContentArea;
    const thisMax = scrollHeight - clientHeight;

    if (thisMax <= 0) return;

    const thatMax = thatPaneContentArea.scrollHeight - thatPaneContentArea.clientHeight;

    if (thatMax <= 0) return;

    const scrollRatio = scrollTop / thisMax;

    // Proportional scroll for both preview modes (Hugo live preview and standard CMS preview)
    isSyncing = true;
    thatPaneContentArea.scrollTop = Math.round(thatMax * scrollRatio);
    window.requestAnimationFrame(() => {
      isSyncing = false;
    });
  };

  /**
   * Throttled scroll listener handler.
   */
  const onScrollTrigger = () => {
    if (isSyncing || !syncScrolling || !thisPaneContentArea || !thatPaneContentArea) {
      return;
    }

    if (rafId) {
      cancelAnimationFrame(rafId);
    }

    rafId = requestAnimationFrame(() => {
      rafId = null;
      syncScrollPosition();
    });
  };

  /**
   * Detach scroll and wheel listeners from a target element.
   * @param {HTMLElement | undefined | null} target Target element.
   */
  const detachListeners = (target) => {
    if (!target) return;
    target.removeEventListener('wheel', onScrollTrigger, eventOptions);
    target.removeEventListener('touchmove', onScrollTrigger, eventOptions);
    target.removeEventListener('scroll', onScrollTrigger, eventOptions);
    target.ownerDocument?.defaultView?.removeEventListener('scroll', onScrollTrigger, eventOptions);
  };

  /**
   * Attach scroll and wheel listeners to a target element.
   * @param {HTMLElement | undefined | null} target Target element.
   */
  const attachListeners = (target) => {
    if (!target) return;
    target.addEventListener('wheel', onScrollTrigger, eventOptions);
    target.addEventListener('touchmove', onScrollTrigger, eventOptions);
    target.addEventListener('scroll', onScrollTrigger, eventOptions);
    target.ownerDocument?.defaultView?.addEventListener('scroll', onScrollTrigger, eventOptions);
  };

  /**
   * Setup scroll synchronization for an iframe (preview mode).
   * @param {HTMLIFrameElement} iframe
   */
  const setupIframe = (iframe) => {
    trackedIframe = iframe;

    const onIframeReady = () => {
      try {
        const doc = iframe.contentDocument;

        if (!doc) return;

        hideIframeScrollbar(doc);

        const scrollEl = doc.scrollingElement || doc.documentElement || doc.body;

        if (scrollEl) {
          detachListeners(thisPaneContentArea);
          thisPaneContentArea = /** @type {HTMLElement} */ (scrollEl);
          attachListeners(thisPaneContentArea);

          // Restore scroll position to match the other pane
          if (thatPaneContentArea) {
            const thatMax = thatPaneContentArea.scrollHeight - thatPaneContentArea.clientHeight;

            if (thatMax > 0) {
              const ratio = thatPaneContentArea.scrollTop / thatMax;
              const thisMax = scrollEl.scrollHeight - scrollEl.clientHeight;

              if (thisMax > 0) {
                scrollEl.scrollTop = Math.round(thisMax * ratio);
              }
            }
          }
        }
      } catch {
        // Ignore potential cross-origin error
      }
    };

    iframe.removeEventListener('load', onIframeReady);
    iframe.addEventListener('load', onIframeReady);

    if (iframe.contentDocument?.readyState === 'complete') {
      onIframeReady();
    }
  };

  /**
   * Initialize the scroll synchronization by setting up event listeners and ensuring the content
   * area is ready.
   */
  const initializeScrollSync = () => {
    if (!contentArea) {
      return;
    }

    detachListeners(thisPaneContentArea);

    // Look for either standard preview iframe or Hugo preview iframe
    const iframe = /** @type {HTMLIFrameElement | null} */ (
      contentArea.querySelector('iframe.preview, iframe.hugo-preview-iframe')
    );

    if (iframe) {
      setupIframe(iframe);
    } else {
      thisPaneContentArea = contentArea;
      attachListeners(thisPaneContentArea);
    }

    // Observe changes to contentArea to detect if an iframe is dynamically added or swapped
    mutationObserver?.disconnect();
    mutationObserver = new MutationObserver(() => {
      const newIframe = /** @type {HTMLIFrameElement | null} */ (
        contentArea?.querySelector('iframe.preview, iframe.hugo-preview-iframe')
      );

      if (newIframe && newIframe !== trackedIframe) {
        setupIframe(newIframe);
      } else if (!newIframe && trackedIframe) {
        trackedIframe = null;
        detachListeners(thisPaneContentArea);
        thisPaneContentArea = contentArea;
        attachListeners(thisPaneContentArea);

        // Restore scroll position to match the other pane
        if (thatPaneContentArea) {
          const thatMax = thatPaneContentArea.scrollHeight - thatPaneContentArea.clientHeight;

          if (thatMax > 0) {
            const ratio = thatPaneContentArea.scrollTop / thatMax;
            const thisMax = contentArea.scrollHeight - contentArea.clientHeight;

            if (thisMax > 0) {
              contentArea.scrollTop = Math.round(thisMax * ratio);
            }
          }
        }
      }
    });

    mutationObserver.observe(contentArea, { childList: true, subtree: true });
  };

  onDestroy(() => {
    mutationObserver?.disconnect();

    if (rafId) {
      cancelAnimationFrame(rafId);
    }

    detachListeners(thisPaneContentArea);
  });

  $effect(() => {
    void [thisPane.current?.mode, contentArea];
    // The initialization writes `thisPaneContentArea`, which it also reads, so it’s left out of
    // the dependencies to keep the effect from running again on its own account
    untrack(() => initializeScrollSync());
  });
</script>

<div role="none" {id} class="wrapper">
  {#if locale && entryDraft.current?.currentLocales[locale]}
    <div
      role="none"
      class="content"
      class:hide-scrollbar={mode === 'preview' && !!thatPaneContentArea}
      bind:this={contentArea}
    >
      <MainContent {locale} />
    </div>
  {:else if mode === 'edit'}
    <EmptyState>
      <span role="alert">
        {_(hasContent ? 'locale_x_now_disabled' : 'locale_x_has_been_disabled', labelOptions)}
      </span>
      <Button
        variant="tertiary"
        label={_(hasContent ? 'reenable_x_locale' : 'enable_x_locale', labelOptions)}
        onclick={() => {
          /* v8 ignore next 3 -- the button is only offered for a disabled locale */
          if (locale && entryDraft.current) {
            toggleLocale({ draft: entryDraft.current, locale });
          }
        }}
      />
    </EmptyState>
  {/if}
</div>

<style>
  .wrapper {
    display: contents;
  }

  .content {
    --field-editor-padding: 16px;
    flex: auto;
    overflow-y: auto;
    scroll-behavior: auto; /* Don’t use smooth scroll for syncing */
    overscroll-behavior-y: contain;

    @media (width < 768px) {
      --field-editor-padding: 12px;
    }

    &.hide-scrollbar {
      scrollbar-width: none;
      -ms-overflow-style: none;

      &::-webkit-scrollbar {
        display: none;
        width: 0;
        height: 0;
      }
    }
  }
</style>

