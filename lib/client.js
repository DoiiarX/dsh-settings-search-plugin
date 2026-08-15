window.__ModuleLoader__.load({
  id: "@local/dsh-settings-search-plugin",
  factory: () => {
    const module = { exports: {} };
    const OWNER = "dsh-settings-search";
    // Candidate sources, in priority order:
    //  0) slot ledger tab-level rows (all registered settings.section entries,
    //     whether or not the owning plugin registers here and whether or not
    //     the section was ever visited) — the declarative, always-complete
    //     index, read from ctx.slots at apply time and refreshed per query.
    //  1) global registration surface: sections OPTIONALLY register rich
    //     item-level rows (keywords + anchors). Registration is an
    //     enhancement, not a requirement.
    //  2) DOM scanning of rendered sections: item-level candidates for
    //     non-registering sections the user has actually visited.
    // Either side may create the registry holder first (settings plugins can
    // load before this one); `register` always writes the shared Map, so
    // whatever loads later sees the complete index.
    const registry = (globalThis.__DSH_SETTINGS_SEARCH__ ??= {
      sections: new Map(), // sectionId -> { label, keywords, items: [{id,label,desc,keywords,tab}] }
      register(sectionId, spec) {
        this.sections.set(sectionId, spec)
        return () => { this.sections.delete(sectionId) }
      },
    });
    function normalize(value) {
      return String(value ?? "").trim().toLocaleLowerCase();
    }
    function matches(query, ...fields) {
      if (!query) return true;
      const q = normalize(query);
      return fields.some((field) => normalize(field).includes(q));
    }
    // Discover item-level candidates from a rendered section DOM. Works for
    // plugins that do not register, across the section shapes DSH actually
    // renders: label > strong + small (local plugins), div[class*=title] +
    // div[class*=desc] (built-in General items), and heading + paragraph
    // section headers. Non-text controls contribute placeholder keywords.
    function scanSectionItems(sectionEl) {
      const items = [];
      const seen = new Set();
      if (!(sectionEl instanceof HTMLElement)) return items;
      const push = (title, desc, keywords) => {
        const label = title.trim();
        if (!label || seen.has(label)) return;
        seen.add(label);
        items.push({ id: label, label, desc: desc || undefined, keywords: `${label} ${desc ?? ""} ${keywords ?? ""}`.trim() });
      };
      // 1) label > strong + small (local plugin shape).
      for (const labelEl of sectionEl.querySelectorAll("label")) {
        const strong = labelEl.querySelector("strong");
        const title = strong?.textContent?.trim();
        if (!title) continue;
        const small = labelEl.querySelector("small");
        const desc = small?.textContent?.trim();
        const controls = [...labelEl.querySelectorAll("input,select,textarea")]
          .map((el) => el.placeholder || el.getAttribute("aria-label") || "")
          .filter(Boolean)
          .join(" ");
        push(title, desc, controls);
      }
      // 2) div[class*=title]/[class*=heading] + sibling/adjacent desc
      //    (built-in General items and plugin section groups). CSS Modules
      //    keeps the word in the hashed name (e.g. _title_1a2b3c /
      //    _groupHeading_4d5e), so the substring selector matches regardless
      //    of the hash.
      for (const titleEl of sectionEl.querySelectorAll('[class*="title"],[class*="heading"]')) {
        const title = titleEl.textContent?.trim();
        if (!title || title.length > 60) continue;
        const container = titleEl.parentElement;
        const descEl = container?.querySelector('[class*="desc"],[class*="description"]');
        const desc = descEl?.textContent?.trim();
        const controls = [...(container?.querySelectorAll("input,select,textarea,button") ?? [])]
          .map((el) => el.placeholder || el.getAttribute("aria-label") || (el.textContent?.trim() ?? ""))
          .filter(Boolean)
          .join(" ");
        push(title, desc, controls);
      }
      // 3) Heading + paragraph section headers (h2 title + p description).
      for (const heading of sectionEl.querySelectorAll("h2,h3")) {
        const title = heading.textContent?.trim();
        if (!title) continue;
        const next = heading.nextElementSibling;
        const desc = next && /^p$/i.test(next.tagName) ? next.textContent?.trim() : undefined;
        push(title, desc);
      }
      // 4) Fallback: any short leaf text that looks like a setting title
      //    (1–30 chars, not a control, not inside a button). Catches heading
      //    containers whose class naming the section author chose freely
      //    (e.g. better-sidebar's plain `groupHeading`), regardless of CSS
      //    Modules hashing. Descendants of the section heading are excluded
      //    by requiring the element itself (or its closest non-span parent)
      //    to hold the text.
      for (const el of sectionEl.querySelectorAll("div,span,section")) {
        const own = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent ?? "").join(" ").trim();
        if (!own || own.length < 1 || own.length > 30) continue;
        if (el.closest("button,input,select,textarea,label")) continue;
        if (el.children.length > 2) continue;
        push(own);
      }
      return items;
    }
    function installSearch(dialog, slots) {
      if (dialog.dataset.settingsSearchReady === "true") return;
      const nav = dialog.querySelector("nav");
      // The dialog element IS the .panel (SettingsRoot puts role=dialog on
      // css.panel), so querySelector('.panel') never matches it; use the
      // dialog itself as the overlay anchor. Section classes (.content /
      // .options / .navLabel) are CSS Modules hashed names, so locate by
      // structure instead of class: content is nav's next sibling, and the
      // scrolling options area is its last child (header precedes it).
      const panel = dialog;
      const list = nav?.querySelector("div:has(> button[aria-current])");
      const content = nav?.nextElementSibling;
      const options = content?.lastElementChild;
      if (!(nav instanceof HTMLElement) || list === null || !(options instanceof HTMLElement)) return;
      dialog.dataset.settingsSearchReady = "true";
      const wrapper = document.createElement("div");
      wrapper.dataset.settingsSearchOwner = OWNER;
      wrapper.style.cssText = "padding:0 12px 4px;";
      const input = document.createElement("input");
      input.type = "search";
      input.placeholder = "搜索设置或插件…";
      input.setAttribute("aria-label", "搜索设置或插件");
      input.autocomplete = "off";
      input.style.cssText = "box-sizing:border-box;width:100%;height:34px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;color:var(--dsw-alias-label-primary);background:var(--dsw-specific-input-major);font:inherit;outline:none;";
      wrapper.append(input);
      nav.insertBefore(wrapper, list);
      // Candidate overlay sits over the content column, below the header row.
      // The header height and nav width vary by theme, so read them live.
      const header = content?.firstElementChild;
      const headerHeight = header instanceof HTMLElement ? header.offsetHeight : 54;
      const overlay = document.createElement("div");
      overlay.dataset.settingsSearchOwner = OWNER;
      overlay.hidden = true;
      overlay.style.cssText = `position:absolute;top:${headerHeight}px;right:0;bottom:0;left:${nav.offsetWidth}px;overflow-y:auto;padding:24px 24px 24px;background:var(--dsw-alias-bg-layer-2);z-index:20;`;
      panel.append(overlay);
      const rows = () => [...list.querySelectorAll(":scope > button")];
      // Nav label: the button's label span is the only non-svg text. The span
      // class is CSS Modules hashed (can't select by class), so take the last
      // child span — svg has no textContent, and any sibling (badge, count)
      // would come after the label; prefer the longest text node run.
      const navLabel = (row) => {
        const spans = [...row.querySelectorAll("span")];
        const text = spans.map((s) => s.textContent?.trim() ?? "").filter(Boolean)
          .sort((a, b) => b.length - a.length)[0];
        return normalize(text || (row.textContent ?? ""));
      };
      const activeSectionId = () => {
        const active = rows().find((row) => row.getAttribute("aria-current") === "true");
        return active ? navLabel(active) : undefined;
      };
      // Item-level candidates scanned from rendered sections, keyed by section
      // label (nav identity). Populated lazily as sections render.
      const scanned = new Map(); // navLabel -> [{id,label,desc,keywords}]
      const scanActiveSection = () => {
        const id = activeSectionId();
        if (id) scanned.set(id, scanSectionItems(options));
      };
      const sectionObserver = new MutationObserver(scanActiveSection);
      sectionObserver.observe(options, { childList: true, subtree: true, characterData: true });
      scanActiveSection();
      const navButtonFor = (sectionId, label) => {
        const byLabel = label ? rows().find((row) => navLabel(row) === normalize(label)) : undefined;
        if (byLabel) return byLabel;
        return rows().find((row) => row.getAttribute("data-settings-id") === sectionId);
      };
      const candidateRows = (query) => {
        const results = [];
        // 0) Tab-level from the slot ledger: every registered settings.section
        //    entry, whether its plugin registers search metadata or not and
        //    whether the section was ever visited. This is the declarative,
        //    always-complete index.
        const ledgerSections = slots?.entries?.("settings.section") ?? [];
        const ledgerLabels = new Set();
        for (const entry of ledgerSections) {
          const rawLabel = entry?.options?.label;
          const label = typeof rawLabel === "function" ? rawLabel() : rawLabel;
          const text = String(label ?? entry?.options?.id ?? "").trim();
          if (!text) continue;
          ledgerLabels.add(text);
          if (matches(query, text, entry?.options?.id)) {
            results.push({ kind: "section", sectionId: text, label: text, tab: text, ledger: true });
          }
        }
        // 1) Tab-level from the rendered nav: catches sections whose ledger
        //    label is dynamic and anything the ledger misses. Skip labels the
        //    ledger already produced to avoid duplicate rows.
        for (const row of rows()) {
          const label = navLabel(row);
          if (!label) continue;
          if (ledgerLabels.has(label)) continue;
          if (matches(query, label)) {
            results.push({ kind: "section", sectionId: label, label, tab: label });
          }
        }
        // 2) Item-level from the registration surface (rich keywords + anchors).
        for (const [sectionId, spec] of registry.sections) {
          const sectionLabel = spec.label ?? sectionId;
          for (const item of spec.items ?? []) {
            if (matches(query, item.label, item.desc, item.keywords)) {
              results.push({ kind: "item", sectionId, itemId: item.id, label: item.label, desc: item.desc, tab: sectionLabel, anchored: true });
            }
          }
        }
        // 3) Item-level from DOM scanning (non-registering sections already seen).
        for (const [sectionLabel, items] of scanned) {
          for (const item of items) {
            if (matches(query, item.label, item.desc, item.keywords)) {
              results.push({ kind: "item", sectionId: sectionLabel, itemId: item.id, label: item.label, desc: item.desc, tab: sectionLabel, anchored: false });
            }
          }
        }
        return results;
      };
      const render = () => {
        const query = input.value.trim();
        if (!query) {
          overlay.hidden = true;
          overlay.replaceChildren();
          return;
        }
        const results = candidateRows(query);
        overlay.replaceChildren();
        if (!results.length) {
          const empty = document.createElement("div");
          empty.style.cssText = "padding:18px 4px;color:var(--dsw-alias-label-tertiary);font-size:13px;";
          empty.textContent = "无匹配的设置项";
          overlay.append(empty);
        } else {
          for (const result of results) {
            const rowEl = document.createElement("button");
            rowEl.type = "button";
            rowEl.style.cssText = "display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;margin-bottom:4px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;";
            const text = document.createElement("span");
            text.style.cssText = "display:grid;gap:2px;min-width:0;";
            const name = document.createElement("span");
            name.style.cssText = "font-size:14px;font-weight:600;";
            name.textContent = result.label;
            text.append(name);
            if (result.desc) {
              const desc = document.createElement("span");
              desc.style.cssText = "font-size:12px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
              desc.textContent = result.desc;
              text.append(desc);
            }
            rowEl.append(text);
            const badge = document.createElement("span");
            badge.style.cssText = "flex:none;font-size:11px;padding:2px 8px;border-radius:999px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);";
            badge.textContent = result.tab;
            rowEl.append(badge);
            rowEl.addEventListener("click", () => {
              const button = navButtonFor(result.sectionId, result.tab);
              if (button instanceof HTMLElement) button.click();
              overlay.hidden = true;
              overlay.replaceChildren();
              input.value = "";
              if (result.kind === "item" && result.itemId) {
                // Focus the item after the section renders: anchored (registered)
                // rows use data-settings-item; scanned rows match by label text.
                setTimeout(() => {
                  let target = null;
                  if (result.anchored) {
                    target = dialog.querySelector(`[data-settings-item="${CSS.escape(result.itemId)}"]`);
                  }
                  if (!(target instanceof HTMLElement)) {
                    const optionsEl = dialog.querySelector(".options");
                    target = [...(optionsEl?.querySelectorAll("label") ?? [])]
                      .find((labelEl) => normalize(labelEl.querySelector("strong")?.textContent ?? "") === normalize(result.itemId));
                  }
                  target?.scrollIntoView({ behavior: "smooth", block: "center" });
                  if (target instanceof HTMLElement) {
                    target.style.outline = "2px solid var(--dsw-specific-accent, #4f7cff)";
                    target.style.outlineOffset = "3px";
                    setTimeout(() => { target.style.outline = ""; target.style.outlineOffset = ""; }, 1600);
                  }
                }, 120);
              }
            });
            overlay.append(rowEl);
          }
        }
        overlay.hidden = false;
      };
      input.addEventListener("input", render);
      return () => {
        input.removeEventListener("input", render);
        sectionObserver.disconnect();
        overlay.remove();
        wrapper.remove();
        delete dialog.dataset.settingsSearchReady;
      };
    }
    function apply(ctx) {
      // The slots service (declared via dsh.client inject) gives the ledger:
      // every settings.section registration regardless of search registration
      // or visit history. Fall back to nav-only when the service is absent.
      const slots = ctx.get("slots");
      ctx.effect(() => {
        const cleanups = new Map();
        const sync = () => {
          const dialogs = new Set([...document.querySelectorAll("[role='dialog'][aria-modal='true']")]);
          for (const [dialog, cleanup] of cleanups) {
            if (!dialogs.has(dialog) || !dialog.isConnected) {
              cleanup();
              cleanups.delete(dialog);
            }
          }
          for (const dialog of dialogs) {
            if (cleanups.has(dialog)) continue;
            const cleanup = installSearch(dialog, slots);
            if (cleanup !== undefined) cleanups.set(dialog, cleanup);
          }
        };
        const observer = new MutationObserver(sync);
        observer.observe(document.body, { childList: true, subtree: true });
        sync();
        return () => {
          observer.disconnect();
          for (const cleanup of cleanups.values()) cleanup();
          cleanups.clear();
        };
      }, "settings-search: candidate list");
    }
    module.exports.apply = apply;
    return module.exports;
  }
});
