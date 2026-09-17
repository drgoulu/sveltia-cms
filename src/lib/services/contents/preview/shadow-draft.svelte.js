import { serializeContent } from '$lib/services/contents/draft/save/serialize';
import { getValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
import { formatFrontMatter } from '$lib/services/contents/file/format';

/**
 * Check if running in a local development environment.
 * @returns {boolean}
 */
const isLocalhost = () => {
  if (typeof window === 'undefined' || !window.location) {
    return false;
  }
  const { hostname } = window.location;
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local')
  );
};

/**
 * Resolves candidate API endpoints for shadow draft preview.
 * When running in development, Sveltia CMS might be loaded as an ES module from the Vite dev server
 * (e.g. port 5173) while the host site / CMS admin page runs on Hugo (e.g. port 1313).
 * @returns {string[]}
 */
const getCandidateApiUrls = () => {
  if (!isLocalhost()) {
    return [];
  }
  const urls = [];
  try {
    if (import.meta?.url) {
      const origin = new URL(import.meta.url).origin;
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        urls.push(`${origin}/api/preview`);
      }
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

  /** @type {string} ID of the currently tracked draft */
  currentDraftId = $state('');

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
   * Verify if the local Hugo server is actually running and responding.
   * @param {string} url Preview URL to test.
   * @returns {Promise<boolean>}
   */
  async verifyHugoServer(url) {
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 1200);
      await fetch(`${url}?_ping=${Date.now()}`, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if the local Vite dev server and Hugo server are available.
   */
  async checkAvailability() {
    if (!isLocalhost()) {
      this.available = false;
      return;
    }

    const candidates = getCandidateApiUrls();
    for (const url of candidates) {
      try {
        const res = await fetch(url, { method: 'GET' });
        if (res.ok) {
          const data = await res.json();
          if (data.enabled) {
            const previewUrl = data.previewUrl || this.previewUrl;
            const hugoReady = typeof data.hugoRunning === 'boolean'
              ? data.hugoRunning
              : await this.verifyHugoServer(previewUrl);
            if (hugoReady) {
              this.#apiUrl = url;
              this.previewUrl = previewUrl;
              this.available = true;
              return;
            }
          }
        }
      } catch {
        // Try next candidate
      }
    }
    this.available = false;
  }

  /**
   * Force an immediate sync of the given entry draft to Hugo shadow preview file.
   * Resets old revision and cached content to guarantee that Hugo receives the new document right away.
   * @param {import('$lib/types/private').EntryDraft} draft Entry draft being edited.
   * @param {string} [locale] Active locale.
   */
  async forceSync(draft, locale) {
    if (!draft || !draft.collection) {
      return;
    }

    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = undefined;
    }

    const draftId = draft.id || '';
    this.currentDraftId = draftId;
    this.#lastSentContent = '';
    const revision = Date.now();
    this.currentRevision = revision;
    this.lastSync = 0; // Signals pending rebuild for this draft

    if (!this.available || !this.#apiUrl) {
      await this.checkAvailability();
    }

    if (!this.#apiUrl && isLocalhost()) {
      this.#apiUrl = 'http://localhost:5173/api/preview';
      this.available = true;
    }

    await this.#performSync(draft, locale || draft.defaultLocale, undefined, revision);
  }

  /**
   * Schedule a sync of the current entry draft to the Hugo shadow draft.
   * Debounced by 200ms to keep Hugo recompilation lightweight.
   * @param {import('$lib/types/private').EntryDraft} draft Current draft.
   * @param {string} locale Current active locale.
   * @param {import('$lib/types/private').FlattenedEntryContent} [valueMap] Latest field values.
   * @param {boolean} [isNewDraft] Whether switching to a new draft.
   */
  scheduleSync(draft, locale, valueMap, isNewDraft = false) {
    if (!draft || !draft.collection) {
      return;
    }

    const draftId = draft.id || '';
    if (isNewDraft || (draftId && draftId !== this.currentDraftId)) {
      this.forceSync(draft, locale);
      return;
    }

    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = undefined;
    }

    if (!this.available) {
      this.checkAvailability().then(() => {
        if (this.available) {
          this.#performSync(draft, locale, valueMap);
        }
      });
      return;
    }

    this.#timer = window.setTimeout(() => {
      this.#performSync(draft, locale, valueMap);
    }, 200);
  }

  async #performSync(draft, locale, valueMap, explicitRevision) {
    try {
      const activeLocale = locale || draft.defaultLocale;
      const values = valueMap ?? getValueMapSnapshot(draft, activeLocale);
      const serialized = serializeContent({ draft, locale: activeLocale, valueMap: { ...values } });

      const collectionName = draft.collection?.name || 'posts';
      const sectionName = collectionName === 'drafts' ? 'posts' : collectionName;

      // Inject Hugo preview options: draft: false, fixed preview URL, and exclude from site lists
      const previewPayload = {
        ...serialized,
        title: serialized.title || 'Aperçu du brouillon',
        slug: 'admin-preview',
        date: serialized.date || new Date().toISOString(),
        type: sectionName,
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

      if (markdown === this.#lastSentContent && !explicitRevision) {
        return;
      }

      if (!this.#apiUrl) {
        return;
      }

      const revision = explicitRevision || Date.now();
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
        this.currentDraftId = draft.id || '';
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
   * Reset shadow draft state and clean server file when switching edited document.
   */
  async reset() {
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = undefined;
    }
    this.#lastSentContent = '';
    this.currentRevision = 0;
    this.lastSync = 0;
    this.currentDraftId = '';
    this.syncing = false;
    await this.clean();
  }

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
