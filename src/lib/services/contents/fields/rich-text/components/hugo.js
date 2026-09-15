import { escapeAttr } from '$lib/services/utils/string';

/**
 * @import { EditorComponentDefinition } from '$lib/types/public';
 */

/**
 * Parse arguments from a Hugo shortcode string, handling named (`key="value"`) and positional arguments.
 * @param {string} rawArgs Raw arguments string inside the shortcode.
 * @returns {Record<string, string>} Parsed arguments map.
 */
export const parseHugoArgs = (rawArgs) => {
  /** @type {Record<string, string>} */
  const result = { _raw: rawArgs || '' };

  if (!rawArgs) return result;

  const regex = /(?:([a-zA-Z0-9_-]+)=)?(?:"([^"]*)"|'([^']*)'|([^\s"']+))/g;
  let match;
  let posIndex = 0;

  while ((match = regex.exec(rawArgs)) !== null) {
    const key = match[1];
    const val = match[2] !== undefined ? match[2] : match[3] !== undefined ? match[3] : match[4];

    if (key) {
      result[key] = val;
    } else {
      result[`_pos_${posIndex}`] = val;

      if (posIndex === 0) {
        result._primary = val;
      }

      posIndex += 1;
    }
  }

  return result;
};

/**
 * Format an object of arguments back into a Hugo shortcode arguments string.
 * @param {Record<string, any>} obj Parsed arguments object.
 * @param {string[]} [excludeKeys] Keys to exclude.
 * @returns {string} Formatted arguments string.
 */
export const formatHugoArgs = (obj, excludeKeys = []) => {
  const parts = [];
  let posIndex = 0;

  while (obj[`_pos_${posIndex}`] !== undefined) {
    const pVal = String(obj[`_pos_${posIndex}`]);

    parts.push(/^[a-zA-Z0-9]+$/.test(pVal) ? pVal : `"${pVal.replaceAll('"', '\\"')}"`);
    posIndex += 1;
  }

  Object.keys(obj).forEach((key) => {
    if (key.startsWith('_') || excludeKeys.includes(key)) return;

    const val = obj[key];

    if (val !== undefined && val !== null && val !== '') {
      parts.push(`${key}="${String(val).replaceAll('"', '\\"')}"`);
    }
  });

  return parts.join(' ');
};

/**
 * Escape HTML special characters for preview output.
 * @param {string | undefined} str Input string.
 * @returns {string} Escaped string.
 */
export const escapeHtml = (str) =>
  String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/**
 * Resolve an image path specified in a Hugo shortcode into an absolute web path.
 * @param {string} src Image source attribute.
 * @returns {string} Resolved image URL.
 */
export const resolveHugoImagePath = (src) => {
  if (!src) return '';

  if (/^(?:https?:|\/\/|data:|blob:)/.test(src)) {
    return src;
  }

  if (src.startsWith('/')) {
    return src;
  }

  const clean = src.replace(/^\.\//, '');

  if (typeof window !== 'undefined' && window.location?.hash) {
    const { hash } = window.location;
    const match = hash.match(/\/entries\/(.+)$/);

    if (match) {
      const entryPath = match[1].split('?')[0];
      const yearMatch =
        entryPath.match(/^(\d{4})\//) || entryPath.match(/(?:^|\/)(\d{4})-\d{2}-\d{2}/);

      if (yearMatch) {
        return `/posts/${yearMatch[1]}/${clean}`;
      }

      const segments = entryPath.split('/');

      if (segments.length > 1) {
        segments.pop();

        return `/posts/${segments.join('/')}/${clean}`;
      }
    }
  }

  return `/posts/${clean}`;
};

/**
 * Hugo Figure shortcode component definition.
 * Supports {{< figure src="..." alt="..." caption="..." link="..." align="..." width="..." >}}
 * @type {EditorComponentDefinition}
 */
export const HUGO_FIGURE_COMPONENT = {
  id: 'hugo-figure',
  label: 'Figure (Hugo)',
  collapsed: true,
  pattern: /{{[<%]\s*figure\s+([^>%]+?)\s*[>%]}}/,
  fromBlock: (match) => parseHugoArgs(match[1]),
  toBlock: (obj) => {
    const args = formatHugoArgs(obj);

    return `{{< figure ${args} >}}`;
  },
  toPreview: (obj) => {
    const rawSrc = obj.src || obj._primary || '';
    const resolvedSrc = resolveHugoImagePath(rawSrc);
    const alt = obj.alt || obj.caption || '';
    const caption = obj.caption || '';
    const link = obj.link || obj.href || '';
    const align = obj.align || obj.class || 'alignright';
    const width = obj.width || '';

    let widthStyle = '';

    if (width) {
      const widthVal = width.endsWith('px') || width.endsWith('%') ? width : `${width}px`;

      widthStyle = `max-width: ${widthVal}; width: 100%;`;
    }

    let floatStyle = '';

    if (align === 'alignleft') {
      floatStyle = 'float:left;margin:0 1.5em 1em 0;';
    } else if (align === 'alignright') {
      floatStyle = 'float:right;margin:0 0 1em 1.5em;';
    } else if (align === 'aligncenter') {
      floatStyle = 'margin:1.2em auto;display:table;clear:both;';
    }

    const imgHtml = `<img src="${escapeAttr(resolvedSrc)}" alt="${escapeAttr(alt)}" style="max-width:100%;height:auto;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.1);display:block;" />`;
    const linkedImg = link
      ? `<a href="${escapeAttr(link)}" target="_blank" rel="noopener">${imgHtml}</a>`
      : imgHtml;
    const captionHtml = caption
      ? `<figcaption style="font-size:0.85em;color:#64748b;margin-top:6px;text-align:center;">${escapeHtml(caption)}</figcaption>`
      : '';

    return `<figure class="${escapeAttr(align)}" style="${floatStyle}${widthStyle}">${linkedImg}${captionHtml}</figure>`;
  },
  fields: [
    { label: 'Image (src)', name: 'src', widget: 'image' },
    { label: 'Titre alternatif (alt)', name: 'alt', widget: 'string', required: false },
    { label: 'Légende (caption)', name: 'caption', widget: 'string', required: false },
    { label: 'Lien (link)', name: 'link', widget: 'string', required: false },
    { label: 'Largeur (width)', name: 'width', widget: 'string', required: false },
    {
      label: 'Alignement',
      name: 'align',
      widget: 'select',
      options: [
        { label: 'Droite (alignright)', value: 'alignright' },
        { label: 'Gauche (alignleft)', value: 'alignleft' },
        { label: 'Centre (aligncenter)', value: 'aligncenter' },
      ],
      default: 'alignright',
      required: false,
    },
  ],
};

/**
 * Hugo YouTube shortcode component definition.
 * Supports {{< youtube id >}} or {{< youtube id="..." >}}
 * @type {EditorComponentDefinition}
 */
export const HUGO_YOUTUBE_COMPONENT = {
  id: 'hugo-youtube',
  label: 'YouTube (Hugo)',
  collapsed: true,
  pattern: /{{[<%]\s*youtube\s+([^>%]+?)\s*[>%]}}/,
  fromBlock: (match) => parseHugoArgs(match[1]),
  toBlock: (obj) => {
    const id = obj.id || obj._primary || '';

    return `{{< youtube "${String(id).replaceAll('"', '\\"')}" >}}`;
  },
  toPreview: (obj) => {
    const id = obj.id || obj._primary || '';

    return (
      '<div style="position:relative;width:100%;padding-bottom:56.25%;height:0;overflow:hidden;margin:1.2em 0;border-radius:8px;background:#000;">' +
      `<iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(id)}" ` +
      'style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen></iframe>' +
      '</div>'
    );
  },
  fields: [{ label: 'ID YouTube ou URL', name: 'id', widget: 'string' }],
};

/**
 * Hugo Vimeo shortcode component definition.
 * Supports {{< vimeo id >}} or {{< vimeo id="..." >}}
 * @type {EditorComponentDefinition}
 */
export const HUGO_VIMEO_COMPONENT = {
  id: 'hugo-vimeo',
  label: 'Vimeo (Hugo)',
  collapsed: true,
  pattern: /{{[<%]\s*vimeo\s+([^>%]+?)\s*[>%]}}/,
  fromBlock: (match) => parseHugoArgs(match[1]),
  toBlock: (obj) => {
    const id = obj.id || obj._primary || '';

    return `{{< vimeo "${String(id).replaceAll('"', '\\"')}" >}}`;
  },
  toPreview: (obj) => {
    const id = obj.id || obj._primary || '';

    return (
      '<div style="position:relative;width:100%;padding-bottom:56.25%;height:0;overflow:hidden;margin:1.2em 0;border-radius:8px;background:#000;">' +
      `<iframe src="https://player.vimeo.com/video/${escapeHtml(id)}" ` +
      'style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen></iframe>' +
      '</div>'
    );
  },
  fields: [{ label: 'ID Vimeo', name: 'id', widget: 'string' }],
};

/**
 * Extract Dailymotion video ID from an ID, path, or URL.
 * @param {any} input ID or URL.
 * @returns {string} Clean ID.
 */
const extractDailymotionId = (input) => {
  const str = String(input ?? '').trim();
  const urlMatch = str.match(/(?:dailymotion\.com\/(?:video|embed\/video)\/|dai\.ly\/)([a-zA-Z0-9]+)/);

  if (urlMatch) return urlMatch[1];

  return str.replace(/^\/?(?:embed\/video\/)?/, '').split(/[?_]/)[0];
};

/**
 * Hugo Dailymotion shortcode component definition.
 * Supports {{< dailymotion id >}} or {{< dailymotion id="..." >}}
 * @type {EditorComponentDefinition}
 */
export const HUGO_DAILYMOTION_COMPONENT = {
  id: 'hugo-dailymotion',
  label: 'Dailymotion (Hugo)',
  collapsed: true,
  pattern: /{{[<%]\s*dailymotion\s+([^>%]+?)\s*[>%]}}/,
  fromBlock: (match) => parseHugoArgs(match[1]),
  toBlock: (obj) => {
    const raw = obj.id || obj._primary || '';
    const id = extractDailymotionId(raw);

    return `{{< dailymotion "${String(id).replaceAll('"', '\\"')}" >}}`;
  },
  toPreview: (obj) => {
    const raw = obj.id || obj._primary || '';
    const id = extractDailymotionId(raw);

    return (
      '<div style="position:relative;width:100%;padding-bottom:56.25%;height:0;overflow:hidden;margin:1.2em 0;border-radius:8px;background:#000;">' +
      `<iframe src="https://www.dailymotion.com/embed/video/${escapeHtml(id)}" ` +
      'style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen></iframe>' +
      '</div>'
    );
  },
  fields: [{ label: 'ID Dailymotion ou URL', name: 'id', widget: 'string' }],
};

/**
 * Hugo OpenBook shortcode component definition (openbook4hugo module).
 * Supports {{< openbook "isbn" >}}
 * @type {EditorComponentDefinition}
 */
export const HUGO_OPENBOOK_COMPONENT = {
  id: 'hugo-openbook',
  label: 'OpenBook (Hugo)',
  collapsed: true,
  pattern: /{{[<%]\s*openbook\s+([^>%]+?)\s*[>%]}}/,
  fromBlock: (match) => {
    const parsed = parseHugoArgs(match[1]);

    return {
      ...parsed,
      isbn: parsed.isbn || parsed.booknumber || parsed.id || parsed._primary || '',
      template: parsed.template || parsed.templatenumber || parsed._pos_1 || '',
    };
  },
  toBlock: (obj) => {
    if (obj.booknumber || obj.templatenumber) {
      const args = formatHugoArgs(obj, ['isbn', 'template', 'id']);

      return `{{< openbook ${args} >}}`;
    }

    const isbn = obj.isbn || obj.id || obj._primary || '';
    const template = obj.template || obj._pos_1 || '';

    if (isbn) {
      const quotedIsbn = `"${String(isbn).replaceAll('"', '\\"')}"`;
      const quotedTemplate = template ? ` "${String(template).replaceAll('"', '\\"')}"` : '';

      return `{{< openbook ${quotedIsbn}${quotedTemplate} >}}`;
    }

    const formatted = formatHugoArgs(obj);

    return `{{< openbook${formatted ? ` ${formatted}` : ''} >}}`;
  },
  toPreview: (obj) => {
    const id = obj.isbn || obj.booknumber || obj.id || obj._primary || '';

    return (
      '<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin:1.2em 0;display:flex;gap:12px;align-items:center;background:#f8fafc;">' +
      '<span style="font-size:26px;">📖</span>' +
      `<div><div style="font-weight:600;color:#0f172a;">Livre OpenBook : <a href="https://openlibrary.org/search?q=${encodeURIComponent(id)}" target="_blank" rel="noopener" style="color:#2563eb;">${escapeHtml(id)}</a></div>` +
      '<div style="font-size:0.85em;color:#64748b;">Notice bibliographique Open Library</div></div>' +
      '</div>'
    );
  },
  fields: [
    { label: 'ISBN ou Titre', name: 'isbn', widget: 'string' },
    { label: 'Modèle (template)', name: 'template', widget: 'string', required: false },
  ],
};

/**
 * Hugo Altmetric shortcode component definition (altmetric4hugo module).
 * Supports {{< altmetric doi="..." ... >}}
 * @type {EditorComponentDefinition}
 */
export const HUGO_ALTMETRIC_COMPONENT = {
  id: 'hugo-altmetric',
  label: 'Altmetric (Hugo)',
  collapsed: true,
  pattern: /{{[<%]\s*altmetric\s+([^>%]+?)\s*[>%]}}/,
  fromBlock: (match) => parseHugoArgs(match[1]),
  toBlock: (obj) => {
    const args = formatHugoArgs(obj);

    return `{{< altmetric ${args} >}}`;
  },
  toPreview: (obj) => {
    const id = obj.doi || obj.arxiv || obj.pmid || obj.id || obj._primary || '';

    return (
      '<div style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 14px;margin:1em 0;display:inline-flex;gap:8px;align-items:center;background:#f8fafc;">' +
      '<span style="font-size:20px;">📊</span>' +
      `<span style="font-size:0.9em;color:#334155;"><strong>Altmetric</strong> : ${escapeHtml(id)}</span>` +
      '</div>'
    );
  },
  fields: [
    { label: 'DOI', name: 'doi', widget: 'string', required: false },
    { label: 'arXiv ID', name: 'arxiv', widget: 'string', required: false },
    { label: 'PMID', name: 'pmid', widget: 'string', required: false },
  ],
};

/**
 * Hugo GitHub Gist shortcode component definition.
 * Supports {{< gist user id [file] >}}
 * @type {EditorComponentDefinition}
 */
export const HUGO_GIST_COMPONENT = {
  id: 'hugo-gist',
  label: 'GitHub Gist (Hugo)',
  collapsed: true,
  pattern: /{{[<%]\s*gist\s+([^>%]+?)\s*[>%]}}/,
  fromBlock: (match) => parseHugoArgs(match[1]),
  toBlock: (obj) => {
    const user = obj.user || obj._pos_0 || '';
    const id = obj.id || obj._pos_1 || '';
    const file = obj.file || obj._pos_2 || '';

    return `{{< gist ${user} ${id}${file ? ` ${file}` : ''} >}}`;
  },
  toPreview: (obj) => {
    const user = obj.user || obj._pos_0 || '';
    const id = obj.id || obj._pos_1 || '';

    return (
      '<div style="border:1px solid #cbd5e1;border-radius:6px;padding:12px;margin:1.2em 0;background:#f8fafc;">' +
      `🐙 <strong>GitHub Gist</strong>: <a href="https://gist.github.com/${escapeHtml(user)}/${escapeHtml(id)}" target="_blank" rel="noopener" style="color:#2563eb;">${escapeHtml(user)}/${escapeHtml(id)}</a>` +
      '</div>'
    );
  },
  fields: [
    { label: 'Utilisateur GitHub', name: 'user', widget: 'string' },
    { label: 'ID du Gist', name: 'id', widget: 'string' },
    { label: 'Fichier spécifique', name: 'file', widget: 'string', required: false },
  ],
};

/**
 * Hugo Highlight paired shortcode component definition.
 * Supports {{< highlight lang [options] >}}code{{< /highlight >}}
 * @type {EditorComponentDefinition}
 */
export const HUGO_HIGHLIGHT_COMPONENT = {
  id: 'hugo-highlight',
  label: 'Highlight (Hugo)',
  collapsed: true,
  pattern:
    /{{[<%]\s*highlight\s+([a-zA-Z0-9_-]+)(?:\s+([^>%]*?))?\s*[>%]}}([\s\S]*?){{[<%]\s*\/highlight\s*[>%]}}/,
  fromBlock: (match) => ({
    lang: match[1],
    options: match[2] || '',
    body: match[3] || '',
  }),
  toBlock: (obj) => {
    const opt = obj.options ? ` ${obj.options}` : '';

    return `{{< highlight ${obj.lang}${opt} >}}\n${obj.body || ''}\n{{< /highlight >}}`;
  },
  toPreview: (obj) =>
    `<pre style="background:#1e293b;color:#f8fafc;padding:12px;border-radius:6px;overflow-x:auto;"><code>${escapeHtml(obj.body)}</code></pre>`,
  fields: [
    { label: 'Langage', name: 'lang', widget: 'string' },
    { label: 'Options', name: 'options', widget: 'string', required: false },
    { label: 'Code', name: 'body', widget: 'text' },
  ],
};

/**
 * Generic fallback component for all other Hugo shortcodes (single or paired).
 * Handles custom shortcodes, module shortcodes, etc.
 * @type {EditorComponentDefinition}
 */
export const HUGO_GENERIC_COMPONENT = {
  id: 'hugo-generic',
  label: 'Shortcode Hugo (Générique)',
  collapsed: true,
  trigger: 'none',
  pattern:
    /{{[<%]\s*(?!(?:\/|highlight|figure|youtube|vimeo|dailymotion|openbook|altmetric|gist)\b)([a-zA-Z0-9_-]+)(?:\s+([^>%]*?))?\s*[>%]}/,
  fromBlock: (match) => ({
    name: match[1],
    args: match[2] || '',
    body: match[3] || '',
  }),
  toBlock: (obj) => {
    const name = obj.name || '';
    const args = obj.args ? ` ${obj.args.trim()}` : '';

    if (obj.body !== undefined && obj.body !== '') {
      return `{{< ${name}${args} >}}\n${obj.body}\n{{< /${name} >}}`;
    }

    return `{{< ${name}${args} >}}`;
  },
  toPreview: (obj) => {
    const name = obj.name || '';
    const args = obj.args || '';
    const body = obj.body || '';

    return (
      '<div style="border:1px dashed #94a3b8;border-radius:6px;padding:10px 14px;margin:1em 0;background:#f8fafc;font-size:0.9em;">' +
      '<div style="display:flex;align-items:center;gap:8px;">' +
      '<span style="color:#64748b;">⚡ Shortcode Hugo :</span>' +
      `<code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;font-weight:bold;color:#0f172a;">${escapeHtml(name)}</code>` +
      (args
        ? `<span style="color:#475569;font-family:monospace;font-size:0.85em;">${escapeHtml(args)}</span>`
        : '') +
      '</div>' +
      (body
        ? `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed #cbd5e1;">${escapeHtml(body)}</div>`
        : '') +
      '</div>'
    );
  },
  fields: [
    { label: 'Nom du shortcode', name: 'name', widget: 'string' },
    { label: 'Arguments', name: 'args', widget: 'string', required: false },
    { label: 'Corps (si bloc fermé)', name: 'body', widget: 'text', required: false },
  ],
};

/**
 * List of all Hugo component definitions.
 */
export const ALL_HUGO_COMPONENTS = [
  HUGO_FIGURE_COMPONENT,
  HUGO_YOUTUBE_COMPONENT,
  HUGO_VIMEO_COMPONENT,
  HUGO_DAILYMOTION_COMPONENT,
  HUGO_OPENBOOK_COMPONENT,
  HUGO_ALTMETRIC_COMPONENT,
  HUGO_GIST_COMPONENT,
  HUGO_HIGHLIGHT_COMPONENT,
  HUGO_GENERIC_COMPONENT,
];

/**
 * Names/IDs of all Hugo components.
 */
export const HUGO_COMPONENT_NAMES = ALL_HUGO_COMPONENTS.map(({ id }) => id);
