<script>
  import { Button, Icon } from '@sveltia/ui';
  import { onDestroy, onMount } from 'svelte';

  import { shadowDraft } from '$lib/services/contents/preview/shadow-draft.svelte';

  /**
   * @typedef {object} Props
   * @property {string | undefined} [draftId] Unique ID of the active draft.
   * @property {() => void} onSwitchToStandard Callback to switch back to classic CMS preview.
   */

  /** @type {Props} */
  let { draftId = undefined, onSwitchToStandard } = $props();

  /** @type {'desktop' | 'tablet' | 'mobile'} */
  let viewport = $state('desktop');
  let iframeKey = $state(0);
  /** @type {HTMLIFrameElement | undefined} */
  let iframeElement = $state();
  let iframeSrc = $state('about:blank');
  let compiling = $state(true);
  let previousDraftId = $state(/** @type {string | undefined} */ (undefined));

  // When changing edited document: immediately clear preview display to avoid showing previous document
  $effect(() => {
    if (draftId !== previousDraftId) {
      compiling = true;
      iframeSrc = 'about:blank';
      iframeKey += 1;
      previousDraftId = draftId;
    }
  });

  const reloadIframe = () => {
    iframeKey += 1;
    iframeSrc = `${shadowDraft.previewUrl}?_t=${Date.now()}`;
  };

  // When shadow draft confirms a sync for this draft, refresh iframe once Hugo has rebuilt this revision
  $effect(() => {
    const syncTime = shadowDraft.lastSync;
    const targetRev = shadowDraft.currentRevision;
    const trackedDraft = shadowDraft.currentDraftId;

    // Only proceed if a sync has been completed for the current draft with a valid revision
    if (syncTime > 0 && targetRev > 0 && (!draftId || trackedDraft === draftId)) {
      compiling = true;
      let cancelled = false;

      const refresh = async () => {
        const maxAttempts = 60;
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          if (cancelled) return;
          try {
            const res = await fetch(`${shadowDraft.previewUrl}?_chk=${Date.now()}`, {
              cache: 'no-store',
            });
            if (res.ok) {
              const html = await res.text();
              const hasRev =
                html.includes(`data-rev="${targetRev}"`) ||
                html.includes(`data-rev=${targetRev}`) ||
                html.includes(String(targetRev));

              if (hasRev) {
                if (!cancelled) {
                  iframeKey += 1;
                  iframeSrc = `${shadowDraft.previewUrl}?_t=${Date.now()}`;
                  compiling = false;
                }
                return;
              }
            }
          } catch {
            // Keep waiting while Hugo rebuilds
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // If polling timed out, allow manual retry rather than forcing stale content
        if (!cancelled && compiling) {
          iframeKey += 1;
          iframeSrc = `${shadowDraft.previewUrl}?_t=${Date.now()}`;
          compiling = false;
        }
      };

      refresh();

      return () => {
        cancelled = true;
      };
    }
  });

  onDestroy(() => {
    shadowDraft.clean();
  });
</script>

<div class="hugo-preview-container">
  <div class="preview-toolbar">
    <div class="status-indicator">
      <span class="live-dot" class:syncing={shadowDraft.syncing || compiling}></span>
      <span class="status-text">
        {#if shadowDraft.syncing || compiling}
          Hugo en cours de compilation…
        {:else}
          Aperçu Hugo en direct
        {/if}
      </span>
    </div>

    <div class="viewport-controls">
      <button
        type="button"
        class="viewport-btn"
        class:active={viewport === 'desktop'}
        title="Pleine largeur"
        onclick={() => (viewport = 'desktop')}
      >
        🖥️
      </button>
      <button
        type="button"
        class="viewport-btn"
        class:active={viewport === 'tablet'}
        title="Format tablette (768px)"
        onclick={() => (viewport = 'tablet')}
      >
        📱 Tablette
      </button>
      <button
        type="button"
        class="viewport-btn"
        class:active={viewport === 'mobile'}
        title="Format mobile (375px)"
        onclick={() => (viewport = 'mobile')}
      >
        📱 Mobile
      </button>
    </div>

    <div class="action-controls">
      <button type="button" class="tool-btn" title="Rafraîchir l'aperçu" onclick={reloadIframe}>
        🔄
      </button>
      <button
        type="button"
        class="tool-btn switch-btn"
        title="Basculer vers l'aperçu standard Sveltia"
        onclick={onSwitchToStandard}
      >
        Vue CMS standard
      </button>
    </div>
  </div>

  <div class="iframe-wrapper viewport-{viewport}">
    {#if compiling || !iframeSrc || iframeSrc === 'about:blank'}
      <div class="loading-state">
        <span class="loading-spinner"></span>
        <span class="loading-message">Génération de l’aperçu Hugo…</span>
      </div>
    {/if}
    {#key iframeKey}
      <iframe
        bind:this={iframeElement}
        src={iframeSrc}
        title="Aperçu Hugo du brouillon"
        class="hugo-preview-iframe"
        class:hidden={compiling || !iframeSrc || iframeSrc === 'about:blank'}
      ></iframe>
    {/key}
  </div>
</div>

<style>
  .hugo-preview-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background: #0f172a;
  }

  .preview-toolbar {
    position: sticky;
    top: 0;
    z-index: 50;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background: #1e293b;
    border-bottom: 1px solid #334155;
    font-size: 0.85rem;
    color: #cbd5e1;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
  }

  .live-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 6px #10b981;
  }

  .live-dot.syncing {
    background: #f59e0b;
    box-shadow: 0 0 6px #f59e0b;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .viewport-controls {
    display: flex;
    gap: 4px;
    background: #0f172a;
    padding: 2px 4px;
    border-radius: 6px;
  }

  .viewport-btn {
    background: transparent;
    border: none;
    color: #94a3b8;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .viewport-btn:hover {
    color: #f8fafc;
  }

  .viewport-btn.active {
    background: #334155;
    color: #f8fafc;
    font-weight: 600;
  }

  .action-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tool-btn {
    background: #334155;
    border: none;
    color: #f8fafc;
    padding: 4px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .tool-btn:hover {
    background: #475569;
  }

  .switch-btn {
    background: transparent;
    border: 1px solid #475569;
    color: #94a3b8;
  }

  .switch-btn:hover {
    background: #334155;
    color: #f8fafc;
  }

  .iframe-wrapper {
    position: relative;
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: stretch;
    overflow: hidden;
    background: #090d16;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    width: 100%;
    height: 100%;
    color: #94a3b8;
    font-size: 0.95rem;
    background: #090d16;
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #1e293b;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .hugo-preview-iframe {
    width: 100%;
    height: 100%;
    border: none;
    background: #ffffff;
    transition: width 0.2s ease-in-out;
  }

  .hugo-preview-iframe.hidden {
    display: none;
  }

  .viewport-desktop .hugo-preview-iframe {
    width: 100%;
  }

  .viewport-tablet .hugo-preview-iframe {
    width: 768px;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.6);
  }

  .viewport-mobile .hugo-preview-iframe {
    width: 375px;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.6);
  }
</style>
