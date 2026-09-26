import { describe, expect, it, vi } from 'vitest';

import {
  getEntryInternalLink,
  getInitialLinkState,
  isHttpUrl,
  searchInternalEntries,
} from './link.js';

vi.mock('$lib/services/contents/collection/entries', () => ({
  getListedCollections: vi.fn((entry) => entry._mockCollections || []),
}));

vi.mock('$lib/services/contents/collection/entries/index-file', () => ({
  isCollectionIndexFile: vi.fn(() => false),
}));

vi.mock('$lib/services/contents/entry', () => ({
  getPreviewPath: vi.fn(({ collection, slug }) =>
    collection.preview_path ? `posts/${slug}` : undefined,
  ),
}));

vi.mock('$lib/services/contents/entry/summary', () => ({
  getEntrySummary: vi.fn(
    (_collection, entry) => entry.locales?._default?.content?.title || entry.slug,
  ),
}));

vi.mock('$lib/services/search/entries', () => ({
  searchEntries: vi.fn(({ entries, terms }) => {
    const lower = terms.toLowerCase();

    return entries
      .filter((e) => {
        const title = e.locales?._default?.content?.title || '';
        const slug = e.slug || '';

        return title.toLowerCase().includes(lower) || slug.toLowerCase().includes(lower);
      })
      .map((entry) => ({ entry, points: 10 }));
  }),
}));

describe('link service', () => {
  describe('isHttpUrl', () => {
    it('returns true for valid HTTP and HTTPS URLs', () => {
      expect(isHttpUrl('http://example.com')).toBe(true);
      expect(isHttpUrl('https://example.com/path?foo=bar')).toBe(true);
      expect(isHttpUrl('  https://drgoulu.com  ')).toBe(true);
      expect(isHttpUrl('HTTP://SITE.ORG')).toBe(true);
    });

    it('returns false for non-HTTP strings and non-strings', () => {
      expect(isHttpUrl('hello world')).toBe(false);
      expect(isHttpUrl('/2017/08/30/slug/')).toBe(false);
      expect(isHttpUrl('ftp://example.com')).toBe(false);
      expect(isHttpUrl('')).toBe(false);
      expect(isHttpUrl(null)).toBe(false);
      expect(isHttpUrl(undefined)).toBe(false);
    });
  });

  describe('getEntryInternalLink', () => {
    it('returns empty string if no entry is provided', () => {
      expect(getEntryInternalLink({ entry: null })).toBe('');
    });

    it('uses preview_path when configured on collection', () => {
      const entry = {
        id: '1',
        slug: 'my-article',
        locales: {
          _default: {
            slug: 'my-article',
            path: 'content/posts/my-article.md',
            content: { title: 'My Article' },
          },
        },
        _mockCollections: [{ name: 'posts', preview_path: '/posts/{{slug}}' }],
      };

      expect(getEntryInternalLink({ entry })).toBe('/posts/my-article');
    });

    it('derives date permalink when content has date', () => {
      const entry = {
        id: '2',
        slug: 'quand-lia-programmera',
        locales: {
          _default: {
            slug: 'quand-lia-programmera',
            path: 'content/posts/2017-08-30-quand-lia-programmera.md',
            content: {
              title: "Quand l'IA programmera",
              date: '2017-08-30',
              slug: 'quand-lia-programmera',
            },
          },
        },
        _mockCollections: [{ name: 'posts' }],
      };

      expect(getEntryInternalLink({ entry })).toBe('/2017/08/30/quand-lia-programmera/');
    });

    it('derives date permalink from file path if content.date is missing', () => {
      const entry = {
        id: '3',
        slug: 'test-post',
        locales: {
          _default: {
            slug: 'test-post',
            path: 'content/posts/2020-05-12-test-post.md',
            content: { title: 'Test Post' },
          },
        },
        _mockCollections: [{ name: 'posts' }],
      };

      expect(getEntryInternalLink({ entry })).toBe('/2020/05/12/test-post/');
    });

    it('falls back to slug when no date is available', () => {
      const entry = {
        id: '4',
        slug: 'about-me',
        locales: {
          _default: {
            slug: 'about-me',
            path: 'content/pages/about-me.md',
            content: { title: 'About Me' },
          },
        },
        _mockCollections: [{ name: 'pages' }],
      };

      expect(getEntryInternalLink({ entry })).toBe('/about-me/');
    });

    it('falls back to subPath if no slug is defined', () => {
      const entry = {
        id: '5',
        subPath: 'custom-subpath',
        locales: {},
        _mockCollections: [],
      };

      expect(getEntryInternalLink({ entry })).toBe('/custom-subpath/');
    });

    it('returns empty string if nothing is defined', () => {
      const entry = {
        id: '6',
        locales: {},
      };

      expect(getEntryInternalLink({ entry })).toBe('');
    });
  });

  describe('searchInternalEntries', () => {
    const mockEntries = [
      {
        id: '1',
        slug: 'quand-lia-programmera',
        locales: {
          _default: {
            slug: 'quand-lia-programmera',
            path: 'content/posts/2017-08-30-quand-lia-programmera.md',
            content: {
              title: "Quand l'IA programmera",
              date: '2017-08-30',
            },
          },
        },
        _mockCollections: [{ name: 'posts', label: 'Articles' }],
      },
      {
        id: '2',
        slug: 'autre-article',
        locales: {
          _default: {
            slug: 'autre-article',
            content: {
              title: 'Autre article',
            },
          },
        },
        _mockCollections: [{ name: 'posts', label: 'Articles' }],
      },
    ];

    it('returns empty array if query or entries is empty', () => {
      expect(searchInternalEntries({ entries: [], query: 'IA' })).toEqual([]);
      expect(searchInternalEntries({ entries: mockEntries, query: '' })).toEqual([]);
      expect(searchInternalEntries({ entries: mockEntries, query: '   ' })).toEqual([]);
    });

    it('searches and formats results', () => {
      const results = searchInternalEntries({ entries: mockEntries, query: 'IA' });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: '1',
        title: "Quand l'IA programmera",
        collectionLabel: 'Articles',
        url: '/2017/08/30/quand-lia-programmera/',
        date: '2017-08-30',
      });
    });
  });

  describe('getInitialLinkState', () => {
    const mockEntries = [
      {
        id: '1',
        slug: 'quand-lia-programmera',
        locales: {
          _default: {
            slug: 'quand-lia-programmera',
            path: 'content/posts/2017-08-30-quand-lia-programmera.md',
            content: {
              title: "Quand l'IA programmera",
              date: '2017-08-30',
            },
          },
        },
        _mockCollections: [{ name: 'posts', label: 'Articles' }],
      },
    ];

    it('handles empty textContent', () => {
      expect(getInitialLinkState({ textContent: '', entries: mockEntries })).toEqual({
        isUrl: false,
        url: '',
        query: '',
        proposedUrl: '',
      });
    });

    it('handles HTTP URLs directly without searching', () => {
      const state = getInitialLinkState({
        textContent: 'https://example.com/article',
        entries: mockEntries,
      });

      expect(state).toEqual({
        isUrl: true,
        url: 'https://example.com/article',
        query: '',
        proposedUrl: 'https://example.com/article',
      });
    });

    it('searches internal entries and proposes internal URL when text is not an HTTP URL', () => {
      const state = getInitialLinkState({
        textContent: "Quand l'IA",
        entries: mockEntries,
      });

      expect(state).toEqual({
        isUrl: false,
        url: '/2017/08/30/quand-lia-programmera/',
        query: "Quand l'IA",
        proposedUrl: '/2017/08/30/quand-lia-programmera/',
      });
    });

    it('leaves proposed URL empty if no match is found', () => {
      const state = getInitialLinkState({
        textContent: 'Un texte sans aucun rapport',
        entries: mockEntries,
      });

      expect(state).toEqual({
        isUrl: false,
        url: '',
        query: 'Un texte sans aucun rapport',
        proposedUrl: '',
      });
    });
  });
});
