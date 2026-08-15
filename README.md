# dsh-settings-search-plugin

English | [中文](README.zh.md)

A browser-only plugin that adds a search field to the DSH Web Settings panel. Typing shows an independent candidate list over the content column; clicking a candidate navigates to the owning section and, for item-level rows, focuses and highlights the setting. Registration is optional — sections are indexed from the slot ledger and from their rendered DOM, so third-party settings pages are searchable without any plugin changes.

## How the index is built

Searchable rows come from three sources, in priority order:

1. **Slot ledger (declarative, always complete)** — every `settings.section` registration is a tab-level candidate, whether its plugin registers search metadata or not and whether the user ever visited the section. The ledger is read through the injected `slots` service, so any plugin that contributes a settings page appears in search immediately.
2. **Registration surface (optional enhancement)** — a settings plugin may call `window.__DSH_SETTINGS_SEARCH__.register(sectionId, spec)` with item-level rows, rich keywords, and `data-settings-item` anchors for precise jump-and-focus. Registration is an opt-in; sections that skip it still get tab-level search from the ledger.
3. **Rendered-DOM scan (visited sections)** — the section observer scans the active section's DOM (`label > strong + small`, `[class*="title"]/[class*="heading"]` groups, headings, and short leaf text) and caches item-level candidates per section. This covers non-registering plugins once the user opens their page; until then only the tab name is searchable.

Candidate rows render as buttons carrying the setting name, an optional description, and a badge with the owning section's label. Clicking an item navigates to its section, scrolls the setting into view, and flashes an outline around it; anchored (registered) rows resolve by `data-settings-item`, scanned rows fall back to matching the setting title text.

## What it reads and writes

The plugin reads the `slots` service for the ledger and observes the settings dialog DOM. It writes nothing on the wire: search state, the registry surface, and the candidate overlay are all page-local. The registration surface is a plain object on `globalThis` (`__DSH_SETTINGS_SEARCH__`) so settings plugins may register before this plugin's bundle mounts; whichever loads first creates the holder, and `register` always writes the shared map.

The dialog and section containers are located by structure (`nav`, `nav`'s next sibling, its last child), not by class — the DSH client uses CSS Modules with hashed names, so class selectors are unreliable. The nav label is read from the button's longest span text to exclude SVG path data.

## Registration reference

```ts
// In a settings plugin's client apply():
window.__DSH_SETTINGS_SEARCH__?.register('local-shell-tools', {
  label: 'Shell',
  keywords: 'shell 终端 命令 cmd bash powershell pwsh 语言环境',
  items: [
    { id: 'bashLang', label: '语言环境', desc: '写入 LANG 与 LC_ALL', keywords: '语言 locale lang 环境' },
  ],
})
```

The registry holder is created lazily by either side, so the optional chain is safe even when this plugin is absent or loads later. `items[].id` should match a `data-settings-item` attribute on the rendered setting's container for anchored focus.

## Model Experience

None, as a presentation-only plugin: search candidates and navigation are browser UI and never reach a model request. The plugin contributes no system-prompt prose and no tool schemas.

#### KV Cache effect

No invalidation. The plugin runs entirely in the browser and changes no model request shape, so it never affects an established prefix.

## Known Limitations and Deferred Work

- **Item-level search for never-visited, non-registering sections** — the ledger supplies tab-level rows for every section, but item-level candidates come from the registration surface or the rendered DOM. A section the user has never opened and whose plugin never registers exposes only its tab name; full item coverage for such sections would require reading each plugin's locale dictionaries or a `searchItems` channel in `slots.register`, both deferred.
- **Candidate text is normalized, not stemmed** — matching is case- and whitespace-normalized substring inclusion; pinyin and fuzzy recall are not implemented.
- **Overlay is a page-local absolute-positioned layer** — it tracks the settings panel's header and nav widths at install time; a theme that changes those dimensions after the dialog mounts needs a panel re-open to re-measure.

## Installation

Copy the block below to your DSH agent and it will finish the install:

```text
Install the settings-search plugin (@doiiarx/dsh-settings-search-plugin):

1. Clone the repo:
   git clone https://github.com/DoiiarX/dsh-settings-search-plugin
   cd dsh-settings-search-plugin
2. Install dependencies: pnpm install
   (the built lib/ output is already committed; peer deps @deepseek-ai/cordis
   and @deepseek-ai/dsh-client-ui-slots come from the harness runtime.)
3. Mount into the web profile: edit $HOME/.dsh/profiles/web/package.json,
   add "@doiiarx/dsh-settings-search-plugin": "link:<absolute-path-to-this-dir>"
   under dependencies, and "@doiiarx/dsh-settings-search-plugin" under
   dsh.profile.bundles.
4. Run pnpm install in the profile directory.
5. Restart the web process and verify the Settings panel shows a search field.
```

This plugin is browser-only (no settings namespace, no model tools), so it
needs no WEB_SETTINGS_NAMESPACES entry and no host rebuild.
