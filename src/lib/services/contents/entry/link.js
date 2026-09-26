import { getListedCollections } from '$lib/services/contents/collection/entries';
import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { getPreviewPath } from '$lib/services/contents/entry';
import { getEntrySummary } from '$lib/services/contents/entry/summary';
import { searchEntries } from '$lib/services/search/entries';

/**
 * @import { Entry } from '$lib/types/private';
 */

/**
 * Check if the given string is a URL starting with http:// or https://.
 * @param {string} [str] String to check.
 * @returns {boolean} True if the string is an HTTP/HTTPS URL.
 */
export const isHttpUrl = (str) => typeof str === 'string' && /^https?:\/\//i.test(str.trim());

/**
 * Get the internal link path for an entry.
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry to get link for.
 * @param {string} [args.locale] Active locale.
 * @returns {string} Internal URL path (e.g. `/2017/08/30/slug/` or `/posts/slug/`).
 */
export const getEntryInternalLink = ({ entry, locale = '_default' }) => {
  if (!entry) {
    return '';
  }

  const collections = getListedCollections(entry);
  const collection = collections[0];
  const locEntry = entry.locales?.[locale] ?? Object.values(entry.locales ?? {})[0];
  const slug = locEntry?.slug ?? entry.slug ?? '';
  const path = locEntry?.path ?? '';
  const content = locEntry?.content ?? {};

  // 1. If collection defines preview_path, use Sveltia's template evaluator
  if (collection?.preview_path) {
    const previewPath = getPreviewPath({
      collection,
      locale,
      slug,
      path,
      content,
      isIndexFile: isCollectionIndexFile(collection, entry),
    });

    if (previewPath) {
      return `/${previewPath.replace(/^\/+/, '')}`;
    }
  }

  // 2. Format Hugo permalinks: /:year/:month/:day/:slug/ if date is present
  const dateVal = content?.date ? String(content.date) : '';

  const dateMatch =
    dateVal.match(/^(\d{4})-(\d{2})-(\d{2})/) || path.match(/(?:^|\/)(\d{4})-(\d{2})-(\d{2})/);

  const entrySlug = content?.slug || slug || entry.subPath;

  if (dateMatch && entrySlug) {
    const [, year, month, day] = dateMatch;

    return `/${year}/${month}/${day}/${entrySlug.replace(/^\/+/, '').replace(/\/+$/, '')}/`;
  }

  // 3. Fallback to slug or subPath
  if (entrySlug) {
    return `/${entrySlug.replace(/^\/+/, '').replace(/\/+$/, '')}/`;
  }

  return '';
};

/**
 * @typedef {object} InternalLinkSearchResult
 * @property {string} id Unique entry ID or URL.
 * @property {string} title Formatted title or summary.
 * @property {string} collectionLabel Collection label.
 * @property {string} url Internal link URL.
 * @property {string} date Formatted date string.
 */

/**
 * Search entries and format results for link picker.
 * @param {object} args Arguments.
 * @param {Entry[]} args.entries Entries to search in.
 * @param {string} args.query Search query terms.
 * @param {string} [args.locale] Current locale.
 * @param {number} [args.maxResults] Maximum results to return.
 * @returns {InternalLinkSearchResult[]} Formatted search results.
 */
export const searchInternalEntries = ({ entries, query, locale = '_default', maxResults = 10 }) => {
  if (!entries?.length || !query?.trim()) {
    return [];
  }

  const searchResults = searchEntries({ entries, terms: query });

  return searchResults.slice(0, maxResults).map(({ entry }) => {
    const collections = getListedCollections(entry);
    const collection = collections[0];
    const title = collection ? getEntrySummary(collection, entry) : entry.slug || entry.id;
    const collectionLabel = collection?.label || collection?.name || '';
    const url = getEntryInternalLink({ entry, locale });
    const locEntry = entry.locales?.[locale] ?? Object.values(entry.locales ?? {})[0];
    const date = locEntry?.content?.date ? String(locEntry.content.date).slice(0, 10) : '';

    return {
      id: entry.id || url,
      title,
      collectionLabel,
      url,
      date,
    };
  });
};

/**
 * Get initial dialog state when opening the insert link dialog.
 * @param {object} args Arguments.
 * @param {string} args.textContent Selected text in the editor.
 * @param {Entry[]} args.entries Entries available for search.
 * @param {string} [args.locale] Current locale.
 * @returns {{ isUrl: boolean, url: string, query: string, proposedUrl: string }} Initial state.
 */
export const getInitialLinkState = ({ textContent = '', entries = [], locale = '_default' }) => {
  const trimmed = textContent.trim();

  if (!trimmed) {
    return {
      isUrl: false,
      url: '',
      query: '',
      proposedUrl: '',
    };
  }

  if (isHttpUrl(trimmed)) {
    return {
      isUrl: true,
      url: trimmed,
      query: '',
      proposedUrl: trimmed,
    };
  }

  // Not an HTTP URL: use text in search and propose corresponding internal link
  const results = searchInternalEntries({ entries, query: trimmed, locale, maxResults: 1 });
  const proposedUrl = results[0]?.url ?? '';

  return {
    isUrl: false,
    url: proposedUrl,
    query: trimmed,
    proposedUrl,
  };
};
