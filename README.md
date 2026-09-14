# Sveltia CMS (Hugo & Advanced Authoring Fork)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Upstream: Sveltia CMS](https://img.shields.io/badge/Forked%20from-Sveltia%20CMS-ff3e00)](https://github.com/sveltia/sveltia-cms)

A customized, enhanced fork of **[Sveltia CMS](https://sveltiacms.app/en/)** optimized for static site generators—especially **[Hugo](https://gohugo.io/)**—featuring true real-time live preview, native shortcode handling, nested subfolder hierarchies, math typesetting, and refined editorial workflows.

---

## 🌟 Acknowledgements & Upstream Credits

This project is a downstream fork of **[Sveltia CMS](https://github.com/sveltia/sveltia-cms)**, created and maintained by **[Kohei Yoshino](https://github.com/kyoshino)** and community contributors.

[Sveltia CMS](https://sveltiacms.app/en/) is the modern, high-performance successor to Netlify CMS / Decap CMS, written from the ground up in Svelte. It provides a lightweight, Git-based headless CMS architecture with first-class internationalization, zero server dependencies, and clean Git workflows.

We are deeply grateful to the Sveltia CMS maintainers and contributors for building such an exceptional foundation. Please visit the official project:
- **Upstream Repository**: [github.com/sveltia/sveltia-cms](https://github.com/sveltia/sveltia-cms)
- **Official Website & Docs**: [sveltiacms.app](https://sveltiacms.app/en/)
- **Upstream Sponsorship**: [github.com/sponsors/kyoshino](https://github.com/sponsors/kyoshino)

---

## 🚀 Key Improvements & Additions Since Forking

This fork introduces powerful capabilities designed specifically for content-heavy static sites, complex Hugo blogs, academic writing, and deep folder structures:

### 1. ⚡ Real-Time Hugo Live Preview (Shadow Draft Engine)
Traditional CMS preview systems rely on generic Markdown approximations that fail to reflect complex Hugo themes, partials, shortcodes, and styling. This fork introduces an instant Hugo live preview:
- **Ultra-low latency (~200ms)**: Uses an in-memory background "shadow draft" (`content/admin-preview.md`) updated incrementally without polluting Git status.
- **Accurate revision tracking**: Employs an exact revision marker (`data-rev`) with smart polling to ensure the preview iframe only reloads when Hugo has finished rebuilding.
- **Synchronized bidirectional scrolling**: Smoothly mirrors scroll position between the Lexical editor and the rendered Hugo preview page.
- **Dual preview switcher**: Switch effortlessly between the built-in Sveltia preview and the fully rendered Hugo site preview directly from the editor toolbar.
- **Distraction-free aesthetics**: Clean iframe presentation with concealed scrollbars and manual refresh controls.

### 2. 🧩 Full Hugo Shortcode & Markdown Extension Support
- **Round-trip shortcode safety**: Full preservation of Hugo shortcode syntax (`{{< ... >}}` and `{{% ... %}}`), preventing parameter corruption, unwanted escaping, or content loss upon saving.
- **Collapsible shortcode cards**: In the rich-text editor, shortcodes render as compact, expandable blocks showing their name and parameters at a glance while keeping the authoring canvas clean and readable.
- **Safe parameter handling**: Positional arguments with special characters and symbols are automatically quoted to prevent Hugo compilation errors.

### 3. 📐 Mathematical Typesetting (KaTeX)
- **Native LaTeX / KaTeX rendering**: Math formulas (inline `$ ... $` and block `$$ ... $$`) render beautifully in both the standard editor preview and the Hugo live preview, catering to scientific and technical writing.

### 4. 📁 Deep Subfolder & Hierarchical Collection Navigation
Hugo projects frequently organize posts by year or topic (e.g. `content/posts/YYYY/`). This fork brings comprehensive hierarchical folder support:
- **Sidebar folder tree**: Subfolders are displayed in a clean, expandable tree with dynamic item counters per year or directory.
- **Folder filtering**: Filter the entry list to specific subfolders and their descendants.
- **Direct entry creation**: Clicking "New Entry" while inside a subfolder automatically creates the post inside that specific directory path.

### 5. 🎛️ Compact & Collapsible Metadata Editor
- **"Settings" / "Paramètres" collapsible card**: Article frontmatter properties (publication date, draft toggle, categories, tags, slug, cover image) are neatly grouped in a collapsible container above the content.
- **Compact two-column layout**: Fields align horizontally on modern displays, drastically reducing wasted vertical space so editors can start writing immediately without scrolling past large metadata blocks.

### 6. 🖼️ Entry-Relative Image & Thumbnail Resolution
- **Relative asset paths (`./images/`)**: Fully resolves relative image paths in page bundles.
- **Thumbnail integration**: Cover image thumbnails appear in collection lists even when stored in subfolder-relative paths (e.g. `content/posts/2026/images/cover.png`).

### 7. 🏷️ Enhanced Boolean Filtering (Hugo-Compatible Drafts)
- **Drafts vs. Published separation**: In Hugo, published articles frequently omit the `draft` attribute rather than specifying `draft: false`. The collection filter (`matchesCollectionFilter`) now treats omitted/undefined boolean properties as `false`.
- **Dedicated collections in `hugo.yaml`**: Allows configuring clean, separate collections in the sidebar for "Articles" (`filter: { field: draft, value: false }`) and "Brouillons" (`filter: { field: draft, value: true }`) with custom icons and default values.

---

## 🛠️ Quick Setup with Hugo

### 1. CMS Configuration (`config/_default/hugo.yaml` or `config.yml`)
```yaml
params:
  headless_cms:
    engine: "sveltia"
    dev_server: "http://localhost:5173"
    collections:
      posts:
        name: "posts"
        label: "Articles"
        folder: "content/posts"
        media_folder: "./images"
        public_folder: "./images"
        icon: "article"
        filter:
          field: draft
          value: false
        fields:
          - { label: Titre, name: title, widget: string }
          - { label: Date, name: date, widget: datetime, type: date }
          - { label: Brouillon, name: draft, widget: boolean, default: false }
          - { label: Image, name: coverImage, widget: image, required: false }
          - { label: Corps, name: body, widget: richtext }
      drafts:
        name: "drafts"
        label: "Brouillons"
        folder: "content/posts"
        media_folder: "./images"
        public_folder: "./images"
        icon: "edit_note"
        filter:
          field: draft
          value: true
        fields:
          - { label: Titre, name: title, widget: string }
          - { label: Date, name: date, widget: datetime, type: date }
          - { label: Brouillon, name: draft, widget: boolean, default: true }
          - { label: Image, name: coverImage, widget: image, required: false }
          - { label: Corps, name: body, widget: richtext }
```

### 2. Running in Development
```bash
# In your sveltia-cms directory:
pnpm install
pnpm dev

# In your Hugo site directory:
hugo server --buildDrafts --buildFuture
```

Navigate to `http://localhost:1313/admin/` to launch the CMS interface.

---

## 🧪 Testing & Quality Assurance

All features and enhancements maintain strict test coverage:
```bash
# Run unit tests
pnpm test

# Run collection service tests
npx vitest run src/lib/services/contents/collection/
```

---

## 📄 License

This project is open source and licensed under the [MIT License](LICENSE), matching the original Sveltia CMS license.
All original work copyright (c) [Kohei Yoshino](https://github.com/kyoshino) and Sveltia CMS contributors.
All enhancements copyright (c) contributors to this fork.
