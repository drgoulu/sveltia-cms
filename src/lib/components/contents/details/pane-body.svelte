<script module>
  /** @type {HTMLElement | null} */
  let activeScroller = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let clearActiveScrollerTimeout = null;
</script>

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

  /** @type {number | null} */
  let rafId = null;

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
    const targetTop = Math.round(thatMax * scrollRatio);

    if (Math.abs(thatPaneContentArea.scrollTop - targetTop) >= 1) {
      thatPaneContentArea.scrollTop = targetTop;
    }
  };

  /**
   * Claim this pane as the active scroller during direct user interaction.
   */
  const onDirectInteraction = () => {
    activeScroller = thisPaneContentArea ?? null;
    if (clearActiveScrollerTimeout) {
      clearTimeout(clearActiveScrollerTimeout);
    }
    clearActiveScrollerTimeout = setTimeout(() => {
      activeScroller = null;
    }, 150);
  };

  /**
   * Throttled scroll listener handler.
   */
  const onScrollTrigger = () => {
    if (!syncScrolling || !thisPaneContentArea || !thatPaneContentArea) {
      return;
    }

    // If another pane is currently driving the scroll, ignore programmatic echo
    if (activeScroller && activeScroller !== thisPaneContentArea) {
      return;
    }

    onDirectInteraction();

    if (rafId) {
      cancelAnimationFrame(rafId);
    }

    rafId = requestAnimationFrame(() => {
      rafId = null;
      syncScrollPosition();
    });
  };

  /** @type {AddEventListenerOptions} */
  const eventOptions = { capture: true, passive: true };

  /**
   * Detach scroll and interaction listeners from a target element.
   * @param {HTMLElement | undefined | null} target Target element.
   */
  const detachListeners = (target) => {
    if (!target) return;
    target.removeEventListener('wheel', onDirectInteraction, eventOptions);
    target.removeEventListener('touchmove', onDirectInteraction, eventOptions);
    target.removeEventListener('pointerdown', onDirectInteraction, eventOptions);
    target.removeEventListener('scroll', onScrollTrigger, eventOptions);
    target.ownerDocument?.defaultView?.removeEventListener('scroll', onScrollTrigger, eventOptions);
  };

  /**
   * Attach scroll and interaction listeners to a target element.
   * @param {HTMLElement | undefined | null} target Target element.
   */
  const attachListeners = (target) => {
    if (!target) return;
    target.addEventListener('wheel', onDirectInteraction, eventOptions);
    target.addEventListener('touchmove', onDirectInteraction, eventOptions);
    target.addEventListener('pointerdown', onDirectInteraction, eventOptions);
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

    if (activeScroller === thisPaneContentArea) {
      activeScroller = null;
    }
    if (clearActiveScrollerTimeout) {
      clearTimeout(clearActiveScrollerTimeout);
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
    <div role="none" class="content" bind:this={contentArea}>
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
  }
</style>

