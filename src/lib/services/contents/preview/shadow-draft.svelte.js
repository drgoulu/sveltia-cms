import { serializeContent } from '$lib/services/contents/draft/save/serialize';
import { getValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
import { formatFrontMatter } from '$lib/services/contents/file/format';

/**
 * Resolves candidate API endpoints for shadow draft preview.
 * When running in development, Sveltia CMS might be loaded as an ES module from the Vite dev server
 * (e.g. port 5173) while the host site / CMS admin page runs on Hugo (e.g. port 1313).
 * @returns {string[]}
 */
const getCandidateApiUrls = () => {
  const urls = [];
  try {
    if (import.meta?.url) {
      const origin = new URL(import.meta.url).origin;
      urls.push(`${origin}/api/preview`);
    }
  } catch {
    // Ignore
  }
  urls.push('http://localhost:5173/api/preview');
  urls.push('/api/preview');
  return [...new Set(urls)];
};

/**
 * Service managing real-time Shadow Draft generation for Hugo live preview.
 */
class ShadowDraftService {
  /** @type {boolean} Whether the local preview API is reachable */
  available = $state(false);

  /** @type {string} Target URL of the Hugo shadow draft preview */
  previewUrl = $state('http://localhost:1313/admin-preview/');

  /** @type {boolean} Whether a sync request is currently inflight */
  syncing = $state(false);

  /** @type {number} Timestamp of the latest successful sync */
  lastSync = $state(0);

  /** @type {number} Current revision ID to verify rendered Hugo output */
  currentRevision = $state(0);

  /** @type {string} Resolved API URL for preview endpoints */
  #apiUrl = '';

  /** @type {number | undefined} Debounce timer ID */
  #timer = undefined;

  /** @type {string} Cache of last sent content to prevent unnecessary syncs */
  #lastSentContent = '';

  constructor() {
    this.checkAvailability();
  }

  /**
   * Check if the local Vite dev server /api/preview endpoint is available.
   */
  async checkAvailability() {
    const candidates = getCandidateApiUrls();
    for (const url of candidates) {
      try {
        const res = await fetch(url, { method: 'GET' });
        if (res.ok) {
          const data = await res.json();
          if (data.enabled) {
            this.#apiUrl = url;
            this.available = true;
            if (data.previewUrl) {
              this.previewUrl = data.previewUrl;
            }
            return;
          }
        }
      } catch {
        // Try next candidate
      }
    }
    this.available = false;
  }

  /**
   * Schedule a sync of the current entry draft to the Hugo shadow draft.
   * Debounced by 300ms to keep Hugo recompilation lightweight.
   * @param {import('$lib/types/private').EntryDraft} draft Current draft.
   * @param {string} locale Current active locale.
   * @param {import('$lib/types/private').FlattenedEntryContent} [valueMap] Latest field values.
   */
  scheduleSync(draft, locale, valueMap) {
    if (!this.available || !draft || !draft.collection) {
      return;
    }

    if (this.#timer) {
      clearTimeout(this.#timer);
    }

    this.#timer = window.setTimeout(() => {
      this.#performSync(draft, locale, valueMap);
    }, 200);
  }

  /**
   * Immediately perform synchronization with Hugo.
   * @param {import('$lib/types/private').EntryDraft} draft
   * @param {string} locale
   * @param {import('$lib/types/private').FlattenedEntryContent} [valueMap]
   */
  async #performSync(draft, locale, valueMap) {
    try {
      const values = valueMap ?? getValueMapSnapshot(draft, locale);
      const serialized = serializeContent({ draft, locale, valueMap: { ...values } });

      // Inject Hugo preview options: draft: false, fixed preview URL, and exclude from site lists
      const previewPayload = {
        ...serialized,
        title: serialized.title || 'Aperçu du brouillon',
        slug: 'admin-preview',
        date: serialized.date || new Date().toISOString(),
        draft: false,
        build: {
          list: 'never',
          render: 'always',
        },
      };

      const fileConfig = draft.collection?._file ?? {
        format: 'yaml-frontmatter',
        fmDelimiters: ['---', '---'],
        bodyField: { key: 'body' },
      };

      const markdown = formatFrontMatter({ content: previewPayload, _file: fileConfig });

      if (markdown === this.#lastSentContent) {
        return;
      }

      if (!this.#apiUrl) {
        return;
      }

      const revision = Date.now();
      const markdownWithRev = `${markdown}\n\n<span id="shadow-preview-rev" data-rev="${revision}" style="display:none"></span>\n`;

      this.syncing = true;
      const res = await fetch(this.#apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: markdownWithRev }),
      });

      if (res.ok) {
        this.#lastSentContent = markdown;
        this.currentRevision = revision;
        this.lastSync = Date.now();
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Shadow draft sync failed:', err);
    } finally {
      this.syncing = false;
    }
  }

  /**
   * Delete shadow draft file on disk when closing or navigating away.
   */
  async clean() {
    if (!this.available || !this.#apiUrl) {
      return;
    }
    this.#lastSentContent = '';
    try {
      await fetch(this.#apiUrl, { method: 'DELETE' });
    } catch {
      // Ignore
    }
  }
}

export const shadowDraft = new ShadowDraftService();
