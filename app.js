(() => {
  const BATCH = 36;
  const MAX_VIDEOS = 6;
  const FRAME = 1 / 30;

  const TABS = [
    { id: "pitchers", label: "Pitchers A–Z" },
    { id: "overlays", label: "Overlays" },
    { id: "pitch-grips", label: "Pitch Grips" },
    { id: "bonus", label: "Bonus" },
  ];
  const ANGLES = ["Side", "Front", "Rear"];
  const PITCHES = ["Changeup", "Curveball", "Slider", "Sinker / 2-Seam", "Cutter", "Fastball", "Splitter", "Knuckleball", "Screwball"];
  const FOCUSES = ["Grip", "Mechanics", "Arm Action", "Lower Half", "Overlay / Tunnel", "Release", "Slow-Mo", "Freeze"];
  const GRIPS = ["Changeup", "Curveball", "Slider", "Sinker & Two-Seam", "Cutter", "Splitter", "Knuckleball", "Screwball"];
  const BONUS_FOLDERS = ["A Mental Game of Pitching", "Javelin throw", "Laminar flow", "Dansby Reactions", "Driveline Stick Fig", "Ninja Turtle"];
  const SECTION_LABEL = {
    pitchers: "Pitchers",
    overlays: "Overlays",
    "pitch-grips": "Pitch grips",
    bonus: "Bonus",
  };
  const SECTION_RANK = { pitchers: 0, overlays: 1, "pitch-grips": 2, bonus: 3 };

  const $ = (id) => document.getElementById(id);
  const countsEl = $("live-counts");
  const tabsEl = $("tabs");
  const qInput = $("q");
  const filterToggle = $("filter-toggle");
  const filtersEl = $("filters");
  const clearBtn = $("clear");
  const angleRow = $("angle-row");
  const pitchRow = $("pitch-row");
  const focusRow = $("focus-row");
  const audioToggle = $("audio-toggle");
  const stillsToggle = $("stills-toggle");
  const letterWrap = $("letter-wrap");
  const lettersEl = $("letters");
  const pitcherWrap = $("pitcher-wrap");
  const pitcherInput = $("pitcher-q");
  const selectedEl = $("selected-pitcher");
  const relatedBtn = $("related");
  const chipsEl = $("pitcher-chips");
  const gripWrap = $("grip-wrap");
  const gripsEl = $("grips");
  const folderWrap = $("folder-wrap");
  const foldersEl = $("folders");
  const libraryEl = $("library");
  const summaryEl = $("summary");
  const grid = $("grid");
  const sentinel = $("sentinel");
  const loadMoreBtn = $("load-more");
  const emptyEl = $("empty");
  const fatalEl = $("fatal");
  const footEl = $("foot");
  const autoplayInput = $("autoplay");
  const autoplayState = $("autoplay-state");
  const lightbox = $("lightbox");
  const lbDialog = lightbox.querySelector(".lb-dialog");
  const lbKicker = $("lb-kicker");
  const lbMedia = $("lb-media");
  const lbTitle = $("lb-title");
  const lbPos = $("lb-pos");
  const lbMeta = $("lb-meta");
  const lbNote = $("lb-note");
  const lbPlay = $("lb-play");
  const lbSpeed = $("lb-speed");
  const lbLoop = $("lb-loop");
  const lbBack = $("lb-back");
  const lbFwd = $("lb-fwd");
  const lbTime = $("lb-time");
  const lbMute = $("lb-mute");
  const lbCopy = $("lb-copy");
  const lbOpen = $("lb-open");
  const lbPrev = $("lb-prev");
  const lbNext = $("lb-next");
  const lbClose = $("lb-close");

  const state = {
    tab: "pitchers",
    q: "",
    qTokens: [],
    letter: "all",
    pitcher: "",
    grip: "all",
    folder: "all",
    angle: "",
    pitch: "",
    focus: "",
    audio: false,
    stills: false,
    related: false,
    clip: "",
    autoplay: true,
    filtersOpen: false,
    shown: 0,
    view: [],
    rate: 1,
    loop: true,
  };

  let catalog = null;
  let items = [];
  const byId = new Map();
  const cardEls = new Map();
  let lastKeep = "";
  let videoScheduled = false;
  let moreChain = 0;
  let lbVideo = null;
  let lbItem = null;
  let navList = [];
  let navIndex = 0;
  let lastFocus = null;
  let copyTimer = 0;

  function fmt(n) {
    return Number(n || 0).toLocaleString("en-US");
  }

  function cssEscape(value) {
    if (window.CSS && typeof CSS.escape === "function") return CSS.escape(String(value));
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenize(raw) {
    const n = normalize(raw);
    return n ? n.split(" ") : [];
  }

  function haystack(item) {
    return normalize([
      item.pitcher,
      item.title,
      item.folder,
      item.gripType,
      ...(item.angles || []),
      ...(item.pitches || []),
      ...(item.focus || []),
    ].filter(Boolean).join(" "));
  }

  function assetUrl(key) {
    if (!key || !catalog) return "";
    const base = String(catalog.mediaBaseUrl || "").replace(/\/+$/, "");
    return `${base}/${String(key).replace(/^\/+/, "")}`;
  }

  function formatDuration(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return "";
    if (n < 60) {
      const rounded = Math.round(n * 10) / 10;
      return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}s`;
    }
    const total = Math.round(n);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function formatClock(value) {
    if (!Number.isFinite(value) || value < 0) return "0:00.00";
    const m = Math.floor(value / 60);
    const s = value - m * 60;
    return `${m}:${s.toFixed(2).padStart(5, "0")}`;
  }

  function formatRes(item) {
    if (!item.width || !item.height) return "";
    return `${item.width}×${item.height}`;
  }

  function formatBytes(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v < 0) return "";
    if (v < 1024) return `${Math.round(v)} B`;
    if (v < 1024 * 1024) return `${v < 10 * 1024 ? (v / 1024).toFixed(1) : Math.round(v / 1024)} KB`;
    return `${(v / (1024 * 1024)).toFixed(1)} MB`;
  }

  function readAutoplayPref() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      const stored = localStorage.getItem("byrd-pitcher-autoplay");
      if (stored === "0") return false;
      if (stored === "1") return true;
    } catch { /* ignore */ }
    return !reduce;
  }

  function readUrl() {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");
    state.tab = TABS.some((t) => t.id === tab) ? tab : "pitchers";
    state.q = params.get("q") || "";
    state.qTokens = tokenize(state.q);
    const letter = (params.get("letter") || "all").toUpperCase();
    state.letter = /^[A-Z]$/.test(letter) ? letter : "all";
    state.pitcher = params.get("pitcher") || "";
    const grip = params.get("grip") || "all";
    state.grip = grip === "all" || GRIPS.includes(grip) ? grip : "all";
    const folder = params.get("folder") || "all";
    state.folder = folder === "all" || BONUS_FOLDERS.includes(folder) ? folder : "all";
    const angle = params.get("angle") || "";
    const pitch = params.get("pitch") || "";
    const focus = params.get("focus") || "";
    state.angle = ANGLES.includes(angle) ? angle : "";
    state.pitch = PITCHES.includes(pitch) ? pitch : "";
    state.focus = FOCUSES.includes(focus) ? focus : "";
    state.audio = params.get("audio") === "1";
    state.stills = params.get("stills") === "1";
    state.related = params.get("related") === "1";
    state.clip = params.get("clip") || "";
    if (state.pitcher) {
      const initial = state.pitcher.charAt(0).toUpperCase();
      if (/^[A-Z]$/.test(initial)) state.letter = initial;
    } else {
      state.related = false;
    }
    if (qInput.value !== state.q) qInput.value = state.q;
  }

  function writeUrl() {
    const params = new URLSearchParams();
    if (state.tab !== "pitchers") params.set("tab", state.tab);
    if (state.q) params.set("q", state.q);
    if (state.tab === "pitchers") {
      if (state.letter !== "all") params.set("letter", state.letter);
      if (state.pitcher) params.set("pitcher", state.pitcher);
      if (state.related && state.pitcher) params.set("related", "1");
    }
    if (state.tab === "pitch-grips" && state.grip !== "all") params.set("grip", state.grip);
    if (state.tab === "bonus" && state.folder !== "all") params.set("folder", state.folder);
    if (state.angle) params.set("angle", state.angle);
    if (state.pitch) params.set("pitch", state.pitch);
    if (state.focus) params.set("focus", state.focus);
    if (state.audio) params.set("audio", "1");
    if (state.stills) params.set("stills", "1");
    if (state.clip) params.set("clip", state.clip);
    const qs = params.toString();
    const next = `${location.pathname}${qs ? `?${qs}` : ""}${location.hash}`;
    const current = `${location.pathname}${location.search}${location.hash}`;
    if (next !== current) history.replaceState(null, "", next);
  }

  function matchFacets(item, except) {
    if (state.qTokens.length && !state.qTokens.every((token) => item._hay.includes(token))) return false;
    if (except !== "angle" && state.angle && !(item.angles || []).includes(state.angle)) return false;
    if (except !== "pitch" && state.pitch && !(item.pitches || []).includes(state.pitch)) return false;
    if (except !== "focus" && state.focus && !(item.focus || []).includes(state.focus)) return false;
    if (except !== "audio" && state.audio && !item.hasAudio) return false;
    if (except !== "stills" && state.stills && item.mediaType !== "image") return false;
    return true;
  }

  function matchGlobal(item) {
    return matchFacets(item, null);
  }

  function matchSection(item) {
    if (state.tab === "pitchers") {
      const related = !!(
        state.related &&
        state.pitcher &&
        item.pitcher === state.pitcher &&
        (item.section === "pitch-grips" || item.section === "overlays")
      );
      const primary = item.section === "pitchers";
      if (!primary && !related) return false;
      if (state.pitcher) return item.pitcher === state.pitcher;
      if (state.letter !== "all") return (item.pitcher || "").charAt(0).toUpperCase() === state.letter;
      return true;
    }
    if (item.section !== state.tab) return false;
    if (state.tab === "pitch-grips" && state.grip !== "all" && item.gripType !== state.grip) return false;
    if (state.tab === "bonus" && state.folder !== "all" && item.folder !== state.folder) return false;
    return true;
  }

  function sectionCount(section) {
    let n = 0;
    for (const item of items) if (item.section === section && matchGlobal(item)) n += 1;
    return n;
  }

  function countWhere(pred) {
    let n = 0;
    for (const item of items) if (pred(item)) n += 1;
    return n;
  }

  function compareItems(a, b) {
    if (state.tab === "bonus" && state.folder === "all") {
      const d = BONUS_FOLDERS.indexOf(a.folder) - BONUS_FOLDERS.indexOf(b.folder);
      if (d) return d;
    } else if (state.tab === "pitch-grips" && state.grip === "all") {
      const d = GRIPS.indexOf(a.gripType) - GRIPS.indexOf(b.gripType);
      if (d) return d;
    } else {
      const d = (a.pitcher || "").localeCompare(b.pitcher || "", undefined, { sensitivity: "base", numeric: true });
      if (d) return d;
    }
    if (state.tab === "pitchers" && state.related && state.pitcher) {
      const d = (SECTION_RANK[a.section] ?? 9) - (SECTION_RANK[b.section] ?? 9);
      if (d) return d;
    }
    const title = (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base", numeric: true });
    if (title) return title;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  }

  function computeView() {
    const view = items.filter((item) => matchSection(item) && matchGlobal(item));
    view.sort(compareItems);
    state.view = view;
    return view;
  }

  function groupKey(item) {
    if (state.tab === "pitchers" || state.tab === "overlays") return item.pitcher || item.folder || "Clip";
    if (state.tab === "pitch-grips") {
      if (state.grip === "all") return item.gripType || "Grip";
      return item.pitcher || item.gripType || "Grip";
    }
    return item.folder || "Bonus";
  }

  function hasActiveFilters() {
    return !!(
      state.q ||
      state.letter !== "all" ||
      state.pitcher ||
      state.grip !== "all" ||
      state.folder !== "all" ||
      state.angle ||
      state.pitch ||
      state.focus ||
      state.audio ||
      state.stills ||
      state.related
    );
  }

  function summaryText(view) {
    const n = view.length;
    const parts = [`${fmt(n)} ${n === 1 ? "clip" : "clips"}`];
    if (state.tab === "pitchers" && state.pitcher) parts.push(state.pitcher);
    if (state.tab === "pitchers" && state.related && state.pitcher) parts.push("grips and overlays included");
    if (state.tab === "pitch-grips" && state.grip !== "all") parts.push(state.grip);
    if (state.tab === "bonus" && state.folder !== "all") parts.push(state.folder);
    return parts.join(" · ");
  }

  function updateAutoplayUI() {
    autoplayInput.checked = state.autoplay;
    autoplayState.textContent = state.autoplay ? "On" : "Hover";
    document.documentElement.dataset.playback = state.autoplay ? "auto" : "hover";
  }

  function renderCounts() {
    const stats = catalog && catalog.stats ? catalog.stats : {};
    const total = stats.totalItems != null ? stats.totalItems : items.length;
    const pitchers = stats.pitcherCount != null
      ? stats.pitcherCount
      : new Set(items.filter((item) => item.section === "pitchers" && item.pitcher).map((item) => item.pitcher)).size;
    countsEl.textContent = `${fmt(total)} clips · ${fmt(pitchers)} pitchers`;
  }

  function renderTabs() {
    const searching = state.qTokens.length > 0;
    tabsEl.replaceChildren();
    for (const tab of TABS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tab";
      button.id = `tab-${tab.id}`;
      button.setAttribute("role", "tab");
      button.dataset.tab = tab.id;
      button.dataset.testid = `tab-${tab.id}`;
      button.dataset.focusKey = `tab-${tab.id}`;
      button.setAttribute("aria-selected", state.tab === tab.id ? "true" : "false");
      button.tabIndex = state.tab === tab.id ? 0 : -1;
      button.setAttribute("aria-controls", "library");
      const label = document.createElement("span");
      label.className = "tab-label";
      label.textContent = tab.label;
      const count = document.createElement("span");
      count.className = "tab-count";
      const n = sectionCount(tab.id);
      count.textContent = fmt(n);
      if (searching && n > 0 && state.tab !== tab.id) count.classList.add("has-hits");
      if (searching && n === 0) count.classList.add("is-zero");
      button.append(label, count);
      tabsEl.append(button);
    }
    libraryEl.setAttribute("aria-labelledby", `tab-${state.tab}`);
    const active = TABS.find((tab) => tab.id === state.tab);
    document.title = state.q
      ? `${state.q} · ${active.label} · Byrd Baseball`
      : `${active.label} · Byrd Baseball`;
  }

  function makePill(label, count, pressed, focusKey, attrs, disabled) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pill";
    button.setAttribute("aria-pressed", pressed ? "true" : "false");
    button.dataset.focusKey = focusKey;
    if (disabled) button.disabled = true;
    Object.entries(attrs || {}).forEach(([key, value]) => {
      button.setAttribute(`data-${key}`, value);
    });
    const text = document.createElement("span");
    text.textContent = label;
    button.append(text);
    if (count != null) {
      const badge = document.createElement("span");
      badge.className = "count";
      badge.textContent = fmt(count);
      button.append(badge);
    }
    return button;
  }

  function renderFacetRow(container, label, options, current, facet) {
    container.replaceChildren();
    const name = document.createElement("span");
    name.className = "filter-label";
    name.textContent = label;
    container.append(name);
    const allCount = countWhere((item) => matchSection(item) && matchFacets(item, facet));
    container.append(makePill("All", allCount, current === "", `${facet}-all`, { facet, value: "" }, false));
    for (const option of options) {
      const count = countWhere((item) => (
        matchSection(item) &&
        matchFacets(item, facet) &&
        (item[facet === "pitch" ? "pitches" : facet === "focus" ? "focus" : "angles"] || []).includes(option)
      ));
      container.append(makePill(
        option,
        count,
        current === option,
        `${facet}-${option}`,
        { facet, value: option },
        count === 0 && current !== option,
      ));
    }
  }

  function renderFilters() {
    const n = [state.angle, state.pitch, state.focus, state.audio, state.stills].filter(Boolean).length;
    filterToggle.textContent = n ? `Filters · ${n}` : "Filters";
    filterToggle.setAttribute("aria-expanded", state.filtersOpen ? "true" : "false");
    filtersEl.hidden = !state.filtersOpen;
    renderFacetRow(angleRow, "Angle", ANGLES, state.angle, "angle");
    renderFacetRow(pitchRow, "Pitch", PITCHES, state.pitch, "pitch");
    renderFacetRow(focusRow, "Focus", FOCUSES, state.focus, "focus");
    const audioCount = countWhere((item) => matchSection(item) && matchFacets(item, "audio") && item.hasAudio);
    const stillCount = countWhere((item) => matchSection(item) && matchFacets(item, "stills") && item.mediaType === "image");
    audioToggle.setAttribute("aria-pressed", state.audio ? "true" : "false");
    stillsToggle.setAttribute("aria-pressed", state.stills ? "true" : "false");
    audioToggle.replaceChildren();
    stillsToggle.replaceChildren();
    audioToggle.append(Object.assign(document.createElement("span"), { textContent: "With audio" }));
    audioToggle.append(Object.assign(document.createElement("span"), { className: "count", textContent: fmt(audioCount) }));
    stillsToggle.append(Object.assign(document.createElement("span"), { textContent: "Stills only" }));
    stillsToggle.append(Object.assign(document.createElement("span"), { className: "count", textContent: fmt(stillCount) }));
    clearBtn.hidden = !hasActiveFilters();
  }

  function letterEnabled(letter) {
    for (const item of items) {
      if (item.section !== "pitchers" || !item.pitcher) continue;
      if (item.pitcher.charAt(0).toUpperCase() !== letter) continue;
      if (matchGlobal(item)) return true;
    }
    return false;
  }

  function renderLetters() {
    letterWrap.hidden = state.tab !== "pitchers";
    if (letterWrap.hidden) return;
    lettersEl.replaceChildren();
    const all = document.createElement("button");
    all.type = "button";
    all.className = "letter";
    all.dataset.letter = "all";
    all.dataset.focusKey = "letter-all";
    all.textContent = "All";
    all.setAttribute("aria-pressed", state.letter === "all" ? "true" : "false");
    lettersEl.append(all);
    for (let code = 65; code <= 90; code += 1) {
      const letter = String.fromCharCode(code);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "letter";
      button.dataset.letter = letter;
      button.dataset.focusKey = `letter-${letter}`;
      button.textContent = letter;
      const enabled = letterEnabled(letter);
      button.disabled = !enabled;
      if (!enabled) button.title = "No pitchers";
      button.setAttribute("aria-pressed", state.letter === letter ? "true" : "false");
      lettersEl.append(button);
    }
  }

  function pitcherChoices() {
    const query = normalize(pitcherInput.value);
    const map = new Map();
    for (const item of items) {
      if (item.section !== "pitchers" || !item.pitcher || !matchGlobal(item)) continue;
      if (query) {
        if (!normalize(item.pitcher).includes(query)) continue;
      } else if (state.letter !== "all" && item.pitcher.charAt(0).toUpperCase() !== state.letter) {
        continue;
      }
      map.set(item.pitcher, (map.get(item.pitcher) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base", numeric: true }));
  }

  function relatedCount(name) {
    let n = 0;
    for (const item of items) {
      if (item.pitcher !== name) continue;
      if (item.section !== "pitch-grips" && item.section !== "overlays") continue;
      if (!matchGlobal(item)) continue;
      n += 1;
    }
    return n;
  }

  function renderChips() {
    const show = state.tab === "pitchers" && (state.letter !== "all" || pitcherInput.value.trim() !== "");
    chipsEl.hidden = !show;
    chipsEl.replaceChildren();
    if (!show) return;
    const rows = pitcherChoices();
    if (!rows.length) {
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent = "No pitchers";
      chipsEl.append(hint);
      return;
    }
    for (const [name, count] of rows) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.dataset.pitcher = name;
      button.dataset.focusKey = `pitcher-${name}`;
      button.setAttribute("aria-pressed", name === state.pitcher ? "true" : "false");
      button.setAttribute("aria-label", `${name}, ${fmt(count)} clips`);
      const label = document.createElement("span");
      label.textContent = name;
      const badge = document.createElement("span");
      badge.className = "count";
      badge.textContent = fmt(count);
      button.append(label, badge);
      chipsEl.append(button);
    }
  }

  function renderSelected() {
    const show = state.tab === "pitchers" && !!state.pitcher;
    selectedEl.hidden = !show;
    selectedEl.replaceChildren();
    if (!show) return;
    const name = document.createElement("span");
    name.textContent = state.pitcher;
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "sel-x";
    clear.dataset.testid = "clear-pitcher";
    clear.textContent = "Clear";
    clear.setAttribute("aria-label", `Clear ${state.pitcher}`);
    selectedEl.append(name, clear);
  }

  function renderRelated() {
    const show = state.tab === "pitchers" && !!state.pitcher;
    relatedBtn.hidden = !show;
    if (!show) return;
    const n = relatedCount(state.pitcher);
    relatedBtn.disabled = n === 0;
    if (n === 0) state.related = false;
    relatedBtn.setAttribute("aria-pressed", state.related ? "true" : "false");
    relatedBtn.textContent = n ? `Include grips & overlays (${fmt(n)})` : "No grip or overlay clips";
  }

  function renderGrips() {
    gripWrap.hidden = state.tab !== "pitch-grips";
    if (gripWrap.hidden) return;
    gripsEl.replaceChildren();
    const allCount = countWhere((item) => item.section === "pitch-grips" && matchGlobal(item));
    gripsEl.append(makePill("All", allCount, state.grip === "all", "grip-all", { grip: "all" }, false));
    for (const grip of GRIPS) {
      const count = countWhere((item) => item.section === "pitch-grips" && matchGlobal(item) && item.gripType === grip);
      gripsEl.append(makePill(grip, count, state.grip === grip, `grip-${grip}`, { grip }, count === 0 && state.grip !== grip));
    }
  }

  function renderFolders() {
    folderWrap.hidden = state.tab !== "bonus";
    if (folderWrap.hidden) return;
    foldersEl.replaceChildren();
    const allCount = countWhere((item) => item.section === "bonus" && matchGlobal(item));
    foldersEl.append(makePill("All", allCount, state.folder === "all", "folder-all", { folder: "all" }, false));
    for (const folder of BONUS_FOLDERS) {
      const count = countWhere((item) => item.section === "bonus" && matchGlobal(item) && item.folder === folder);
      foldersEl.append(makePill(folder, count, state.folder === folder, `folder-${folder}`, { folder }, count === 0 && state.folder !== folder));
    }
  }

  function renderContext() {
    pitcherWrap.hidden = state.tab !== "pitchers";
    renderSelected();
    renderRelated();
    renderChips();
    renderGrips();
    renderFolders();
  }

  function whoText(item) {
    const parts = [];
    if (item.pitcher) parts.push(item.pitcher);
    if (item.folder && item.folder !== item.pitcher) parts.push(item.folder);
    if (state.tab === "pitchers" && state.related && item.section !== "pitchers") {
      parts.push(item.section === "overlays" ? "Overlay" : "Pitch grip");
    }
    return parts.join(" · ");
  }

  function facetList(item) {
    const out = [];
    const seen = new Set();
    const add = (value) => {
      if (!value || seen.has(value)) return;
      seen.add(value);
      out.push(value);
    };
    add(item.gripType);
    for (const value of item.angles || []) add(value);
    for (const value of item.pitches || []) add(value);
    for (const value of item.focus || []) add(value);
    return out;
  }

  function pdfMark() {
    const wrap = document.createElement("div");
    wrap.className = "pdf-mark";
    wrap.innerHTML = '<svg width="36" height="44" viewBox="0 0 36 44" aria-hidden="true"><path d="M6 2h16l8 8v30a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#fffefb" stroke="#202020" stroke-width="1.5"/><path d="M22 2v8h8" fill="none" stroke="#202020" stroke-width="1.5"/><path d="M10 26h16M10 32h12" stroke="#b34315" stroke-width="1.6" stroke-linecap="round"/></svg>';
    const strong = document.createElement("strong");
    strong.textContent = "PDF";
    wrap.append(strong);
    return wrap;
  }

  function makeCard(item) {
    const article = document.createElement("article");
    article.className = `card is-${item.mediaType === "pdf" ? "pdf" : item.mediaType === "image" ? "still" : "video"}`;
    article.dataset.id = item.id;
    article.dataset.type = item.mediaType;
    article.dataset.group = groupKey(item);
    article.dataset.testid = "card";

    const hit = document.createElement("button");
    hit.type = "button";
    hit.className = "card-hit";

    const frame = document.createElement("div");
    frame.className = "frame";
    if (item.posterKey) {
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      if (item.width) img.width = item.width;
      if (item.height) img.height = item.height;
      img.src = assetUrl(item.posterKey);
      frame.append(img);
    } else if (item.mediaType === "pdf") {
      frame.append(pdfMark());
    }
    if (item.hasAudio) {
      const badge = document.createElement("span");
      badge.className = "badge badge-audio";
      badge.textContent = "Audio";
      frame.append(badge);
    }
    if (item.mediaType === "image") {
      const badge = document.createElement("span");
      badge.className = "badge badge-still";
      badge.textContent = "Still";
      frame.append(badge);
    }
    hit.append(frame);

    const body = document.createElement("div");
    body.className = "card-body";
    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = item.title || item.originalName || "Untitled";
    body.append(title);
    const who = whoText(item);
    if (who) {
      const line = document.createElement("p");
      line.className = "card-who";
      line.textContent = who;
      body.append(line);
    }
    const facets = facetList(item);
    if (facets.length) {
      const wrap = document.createElement("div");
      wrap.className = "card-facets";
      for (const facet of facets) {
        const chip = document.createElement("span");
        chip.className = "facet";
        chip.textContent = facet;
        wrap.append(chip);
      }
      body.append(wrap);
    }
    const metaBits = [formatDuration(item.duration), formatRes(item)].filter(Boolean);
    if (metaBits.length) {
      const meta = document.createElement("p");
      meta.className = "card-meta";
      meta.textContent = metaBits.join(" · ");
      body.append(meta);
    }
    if (item.originalName) {
      const file = document.createElement("p");
      file.className = "card-file";
      file.textContent = item.originalName;
      file.title = item.originalName;
      body.append(file);
    }
    hit.append(body);
    article.append(hit);

    if (item.mediaType === "pdf") {
      const link = document.createElement("a");
      link.className = "pdf-open";
      link.href = assetUrl(item.mediaKey);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Open PDF";
      article.append(link);
    }
    return article;
  }

  function resetCards() {
    for (const card of cardEls.values()) unmountVideo(card);
    cardEls.clear();
    grid.replaceChildren();
    lastKeep = "";
  }

  function appendSlice(slice) {
    const frag = document.createDocumentFragment();
    for (const item of slice) {
      const card = makeCard(item);
      cardEls.set(item.id, card);
      frag.append(card);
    }
    grid.append(frag);
  }

  function updateLoadMore() {
    const left = state.view.length - state.shown;
    loadMoreBtn.hidden = left <= 0;
    if (left > 0) loadMoreBtn.textContent = `Load more · ${fmt(left)} remaining`;
  }

  function renderGrid() {
    const view = computeView();
    state.shown = Math.min(BATCH, view.length);
    moreChain = 0;
    resetCards();
    appendSlice(view.slice(0, state.shown));
    summaryEl.textContent = summaryText(view);
    emptyEl.hidden = view.length !== 0;
    grid.hidden = view.length === 0;
    updateLoadMore();
  }

  function sentinelNear() {
    const rect = sentinel.getBoundingClientRect();
    return rect.top <= window.innerHeight + 280;
  }

  function loadMore(fromUser) {
    if (!state.view.length || state.shown >= state.view.length) {
      updateLoadMore();
      moreChain = 0;
      return;
    }
    if (!fromUser && !sentinelNear()) {
      moreChain = 0;
      return;
    }
    const start = state.shown;
    state.shown = Math.min(state.view.length, state.shown + BATCH);
    appendSlice(state.view.slice(start, state.shown));
    updateLoadMore();
    scheduleVideos();
    moreChain += 1;
    if (moreChain > 6) {
      moreChain = 0;
      return;
    }
    requestAnimationFrame(() => {
      const rect = sentinel.getBoundingClientRect();
      if (rect.top < window.innerHeight + 240 && state.shown < state.view.length) loadMore();
      else moreChain = 0;
    });
  }

  function showSkeletons() {
    grid.replaceChildren();
    for (let i = 0; i < 8; i += 1) {
      const skeleton = document.createElement("div");
      skeleton.className = "skeleton";
      grid.append(skeleton);
    }
  }

  function visibleVideoIds() {
    if (!state.autoplay || !lightbox.hidden) return [];
    const stack = document.querySelector(".sticky-stack");
    const topLimit = stack ? stack.getBoundingClientRect().bottom : 0;
    const bottomLimit = window.innerHeight;
    const mid = (topLimit + bottomLimit) / 2;
    const ranked = [];
    for (const card of cardEls.values()) {
      if (card.dataset.type !== "video") continue;
      const frame = card.querySelector(".frame");
      if (!frame) continue;
      const rect = frame.getBoundingClientRect();
      if (rect.height <= 0 || rect.bottom <= topLimit || rect.top >= bottomLimit) continue;
      const visible = Math.min(rect.bottom, bottomLimit) - Math.max(rect.top, topLimit);
      if (visible / rect.height < 0.5) continue;
      ranked.push({ id: card.dataset.id, dist: Math.abs((rect.top + rect.bottom) / 2 - mid) });
    }
    ranked.sort((a, b) => a.dist - b.dist);
    return ranked.slice(0, MAX_VIDEOS).map((row) => row.id);
  }

  function mountVideo(card) {
    if (!card || card.dataset.type !== "video") return;
    const existing = card.querySelector("video");
    if (existing) {
      existing.muted = true;
      if (existing.paused) {
        const pending = existing.play();
        if (pending) pending.catch(() => {});
      }
      return;
    }
    const item = byId.get(card.dataset.id);
    if (!item) return;
    const video = document.createElement("video");
    video.className = "grid-video";
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.loop = true;
    video.preload = "metadata";
    video.tabIndex = -1;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("aria-hidden", "true");
    video.disablePictureInPicture = true;
    if (item.posterKey) video.poster = assetUrl(item.posterKey);
    const reveal = () => {
      if (video.readyState >= 2 && !video.paused) video.classList.add("is-ready");
    };
    video.addEventListener("playing", reveal);
    video.addEventListener("timeupdate", reveal);
    video.addEventListener("volumechange", () => {
      if (!video.muted) video.muted = true;
    });
    video.addEventListener("error", () => {
      if (video.dataset.dead === "1") return;
      unmountVideo(card);
    });
    const frame = card.querySelector(".frame");
    frame.append(video);
    video.src = assetUrl(item.mediaKey);
    const pending = video.play();
    if (pending) pending.catch(() => {});
  }

  function unmountVideo(card) {
    if (!card) return;
    const video = card.querySelector("video");
    if (!video || video.dataset.dead === "1") return;
    video.dataset.dead = "1";
    video.pause();
    video.removeAttribute("src");
    try { video.load(); } catch { /* ignore */ }
    video.remove();
  }

  function applyVideos() {
    const desired = state.autoplay && lightbox.hidden ? visibleVideoIds() : [];
    const hover = [];
    if (!state.autoplay && lightbox.hidden) {
      for (const card of cardEls.values()) {
        if (card.dataset.type === "video" && card.matches(":hover")) hover.push(card.dataset.id);
      }
    }
    const keep = [];
    for (const id of hover) {
      if (keep.length < MAX_VIDEOS) keep.push(id);
    }
    for (const id of desired) {
      if (keep.length >= MAX_VIDEOS) break;
      if (!keep.includes(id)) keep.push(id);
    }
    const key = keep.join("|");
    if (key === lastKeep) {
      const mountedIds = [];
      for (const card of cardEls.values()) {
        if (card.querySelector("video")) mountedIds.push(card.dataset.id);
      }
      if (mountedIds.length === keep.length && keep.every((id) => mountedIds.includes(id))) return;
    }
    lastKeep = key;
    const keepSet = new Set(keep);
    for (const card of cardEls.values()) {
      if (card.querySelector("video") && !keepSet.has(card.dataset.id)) unmountVideo(card);
    }
    for (const id of keep) mountVideo(cardEls.get(id));
    grid.dataset.activeVideos = String(grid.querySelectorAll("video").length);
  }

  function scheduleVideos() {
    if (videoScheduled) return;
    videoScheduled = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        videoScheduled = false;
        applyVideos();
      });
    });
  }

  function isLightboxOpen() {
    return !lightbox.hidden;
  }

  function navListFor(item) {
    if (state.view.some((entry) => entry.id === item.id)) return state.view;
    const pool = items.filter((entry) => entry.section === item.section && matchGlobal(entry));
    pool.sort(compareItems);
    if (pool.some((entry) => entry.id === item.id)) return pool;
    return [item];
  }

  function setSpeedButtons() {
    for (const button of lbSpeed.querySelectorAll("[data-rate]")) {
      button.setAttribute("aria-pressed", Number(button.dataset.rate) === state.rate ? "true" : "false");
    }
  }

  function syncPlayButton() {
    if (!lbVideo) {
      lbPlay.textContent = "Play";
      return;
    }
    lbPlay.textContent = lbVideo.paused || lbVideo.ended ? "Play" : "Pause";
  }

  function syncMute() {
    if (!lbVideo) return;
    const muted = !!lbVideo.muted;
    lbMute.textContent = muted ? "Unmute" : "Mute";
    lbMute.setAttribute("aria-label", muted ? "Unmute" : "Mute");
    lbMute.classList.toggle("is-hot", !muted);
  }

  function syncTime() {
    if (!lbVideo) {
      lbTime.textContent = "";
      return;
    }
    const dur = Number.isFinite(lbVideo.duration) ? lbVideo.duration : null;
    lbTime.textContent = dur != null ? `${formatClock(lbVideo.currentTime)} / ${formatClock(dur)}` : formatClock(lbVideo.currentTime);
  }

  function addMeta(term, value) {
    if (!value) return;
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = value;
    lbMeta.append(dt, dd);
  }

  function renderLightbox() {
    const item = lbItem;
    if (!item) return;
    if (lbVideo) {
      lbVideo.pause();
      lbVideo.removeAttribute("src");
      try { lbVideo.load(); } catch { /* ignore */ }
      lbVideo = null;
    }
    lbMedia.replaceChildren();
    lbKicker.textContent = SECTION_LABEL[item.section] || item.section || "";
    lbTitle.textContent = item.title || item.originalName || "Untitled";
    lbPos.textContent = navList.length ? `${navIndex + 1} of ${navList.length}` : "";
    lbNote.hidden = true;
    lbNote.textContent = "";
    lbMeta.replaceChildren();
    addMeta("Pitcher", item.pitcher || "");
    addMeta("Folder", item.folder || "");
    addMeta("Grip", item.gripType || "");
    addMeta("Angle", (item.angles || []).join(", "));
    addMeta("Pitch", (item.pitches || []).join(", "));
    addMeta("Focus", (item.focus || []).join(", "));
    addMeta("Duration", formatDuration(item.duration));
    addMeta("Resolution", formatRes(item));
    if (item.hasAudio) addMeta("Audio", "Yes");
    addMeta("Original file", item.originalName || "");
    addMeta("File size", formatBytes(item.bytes));

    const isVideo = item.mediaType === "video";
    lbPlay.hidden = !isVideo;
    lbSpeed.hidden = !isVideo;
    lbLoop.hidden = !isVideo;
    lbBack.hidden = !isVideo;
    lbFwd.hidden = !isVideo;
    lbTime.hidden = !isVideo;
    lbMute.hidden = !(isVideo && item.hasAudio);
    lbMute.classList.toggle("is-prominent", !!(isVideo && item.hasAudio));
    lbOpen.href = assetUrl(item.mediaKey);
    lbOpen.textContent = item.mediaType === "pdf" ? "Open PDF" : "Open direct file";
    lbPrev.disabled = navIndex <= 0;
    lbNext.disabled = navIndex >= navList.length - 1;
    lbLoop.setAttribute("aria-pressed", state.loop ? "true" : "false");
    setSpeedButtons();

    if (item.mediaType === "image") {
      const img = document.createElement("img");
      img.alt = item.title || "";
      img.src = assetUrl(item.mediaKey);
      lbMedia.append(img);
      return;
    }
    if (item.mediaType === "pdf") {
      const box = document.createElement("div");
      box.className = "pdf-stage";
      const label = document.createElement("p");
      label.className = "pdf-stage-label";
      label.textContent = "PDF";
      const name = document.createElement("p");
      name.textContent = item.originalName || item.title || "Document";
      box.append(label, name);
      lbMedia.append(box);
      return;
    }

    const video = document.createElement("video");
    video.id = "lb-video";
    video.dataset.testid = "lb-video";
    video.playsInline = true;
    video.preload = "auto";
    video.loop = state.loop;
    video.setAttribute("playsinline", "");
    video.disablePictureInPicture = true;
    const startUnmuted = !!item.hasAudio;
    video.muted = !startUnmuted;
    video.defaultMuted = !startUnmuted;
    if (startUnmuted) video.removeAttribute("muted");
    else video.setAttribute("muted", "");
    video.addEventListener("play", syncPlayButton);
    video.addEventListener("pause", syncPlayButton);
    video.addEventListener("ended", syncPlayButton);
    video.addEventListener("timeupdate", syncTime);
    video.addEventListener("seeked", syncTime);
    video.addEventListener("loadedmetadata", () => {
      video.playbackRate = state.rate;
      video.loop = state.loop;
      syncTime();
    });
    video.addEventListener("durationchange", syncTime);
    lbMedia.append(video);
    lbVideo = video;
    video.src = assetUrl(item.mediaKey);
    video.playbackRate = state.rate;
    syncMute();
    syncPlayButton();
    const pending = video.play();
    if (pending) {
      pending.then(() => {
        syncPlayButton();
        syncMute();
      }).catch(() => {
        if (!video.muted) {
          video.muted = true;
          syncMute();
          lbNote.hidden = false;
          lbNote.textContent = "Playing muted. Unmute to hear audio.";
          const retry = video.play();
          if (retry) retry.catch(() => {});
        }
      });
    }
  }

  function openLightbox(id) {
    const item = byId.get(id);
    if (!item) return;
    navList = navListFor(item);
    navIndex = Math.max(0, navList.findIndex((entry) => entry.id === item.id));
    lbItem = item;
    state.clip = item.id;
    if (!isLightboxOpen()) lastFocus = document.activeElement;
    lightbox.hidden = false;
    document.body.classList.add("is-locked");
    writeUrl();
    renderLightbox();
    scheduleVideos();
    lbClose.focus();
  }

  function closeLightbox() {
    if (lbVideo) {
      lbVideo.pause();
      lbVideo.removeAttribute("src");
      try { lbVideo.load(); } catch { /* ignore */ }
      lbVideo = null;
    }
    lbMedia.replaceChildren();
    lbItem = null;
    lightbox.hidden = true;
    document.body.classList.remove("is-locked");
    state.clip = "";
    writeUrl();
    scheduleVideos();
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  function stepClip(dir) {
    const next = navIndex + dir;
    if (!navList.length || next < 0 || next >= navList.length) return;
    navIndex = next;
    lbItem = navList[navIndex];
    state.clip = lbItem.id;
    writeUrl();
    renderLightbox();
  }

  function togglePlay() {
    if (!lbVideo) return;
    if (lbVideo.paused || lbVideo.ended) {
      const pending = lbVideo.play();
      if (pending) pending.catch(() => {});
    } else {
      lbVideo.pause();
    }
    syncPlayButton();
  }

  function stepFrame(dir) {
    if (!lbVideo) return;
    lbVideo.pause();
    syncPlayButton();
    const duration = Number.isFinite(lbVideo.duration) ? lbVideo.duration : Number.POSITIVE_INFINITY;
    const next = Math.min(duration, Math.max(0, (lbVideo.currentTime || 0) + dir * FRAME));
    try { lbVideo.currentTime = next; } catch { /* ignore */ }
    syncTime();
  }

  function restoreFocus(focusKey, searchFocused, pitcherFocused, qSel, pSel) {
    if (searchFocused) {
      qInput.focus();
      if (qSel) qInput.setSelectionRange(qSel[0], qSel[1]);
      return;
    }
    if (pitcherFocused) {
      pitcherInput.focus();
      if (pSel) pitcherInput.setSelectionRange(pSel[0], pSel[1]);
      return;
    }
    if (!focusKey) return;
    const el = document.querySelector(`[data-focus-key="${cssEscape(focusKey)}"]`);
    if (el && typeof el.focus === "function") el.focus();
  }

  function render(options = {}) {
    const focusKey = document.activeElement && document.activeElement.dataset
      ? document.activeElement.dataset.focusKey || ""
      : "";
    const searchFocused = document.activeElement === qInput;
    const pitcherFocused = document.activeElement === pitcherInput;
    const qSel = searchFocused ? [qInput.selectionStart, qInput.selectionEnd] : null;
    const pSel = pitcherFocused ? [pitcherInput.selectionStart, pitcherInput.selectionEnd] : null;

    renderCounts();
    renderTabs();
    renderFilters();
    renderLetters();
    renderContext();
    renderGrid();
    if (options.writeHistory !== false) writeUrl();
    updateAutoplayUI();
    if (options.resetScroll) window.scrollTo(0, 0);
    restoreFocus(focusKey, searchFocused, pitcherFocused, qSel, pSel);
    scheduleVideos();
  }

  function clearFilters() {
    state.q = "";
    state.qTokens = [];
    state.letter = "all";
    state.pitcher = "";
    state.grip = "all";
    state.folder = "all";
    state.angle = "";
    state.pitch = "";
    state.focus = "";
    state.audio = false;
    state.stills = false;
    state.related = false;
    qInput.value = "";
    pitcherInput.value = "";
    render({ resetScroll: true });
  }

  function renderFooter() {
    const stats = (catalog && catalog.stats) || {};
    const total = stats.totalItems != null ? stats.totalItems : items.length;
    let when = "";
    if (catalog && catalog.generatedAt) {
      const date = new Date(catalog.generatedAt);
      if (!Number.isNaN(date.getTime())) {
        when = date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
      }
    }
    footEl.textContent = when
      ? `${fmt(total)} items in catalog · Generated ${when}`
      : `${fmt(total)} items in catalog`;
  }

  function fallbackCopy(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-999px";
    document.body.append(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    area.remove();
    return ok;
  }

  function bindEvents() {
    qInput.addEventListener("input", () => {
      state.q = qInput.value;
      state.qTokens = tokenize(state.q);
      render({ resetScroll: true });
    });

    pitcherInput.addEventListener("input", () => {
      renderChips();
    });

    pitcherInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const first = chipsEl.querySelector("[data-pitcher]");
      if (first) first.click();
    });

    filterToggle.addEventListener("click", () => {
      state.filtersOpen = !state.filtersOpen;
      filtersEl.hidden = !state.filtersOpen;
      filterToggle.setAttribute("aria-expanded", state.filtersOpen ? "true" : "false");
    });

    clearBtn.addEventListener("click", clearFilters);

    autoplayInput.addEventListener("change", () => {
      state.autoplay = autoplayInput.checked;
      try { localStorage.setItem("byrd-pitcher-autoplay", state.autoplay ? "1" : "0"); } catch { /* ignore */ }
      updateAutoplayUI();
      lastKeep = "";
      scheduleVideos();
    });

    tabsEl.addEventListener("click", (event) => {
      const button = event.target.closest("[data-tab]");
      if (!button || button.dataset.tab === state.tab) return;
      state.tab = button.dataset.tab;
      if (isLightboxOpen()) closeLightbox();
      render({ resetScroll: true });
    });

    lettersEl.addEventListener("click", (event) => {
      const button = event.target.closest("[data-letter]");
      if (!button || button.disabled) return;
      state.letter = button.dataset.letter;
      state.pitcher = "";
      state.related = false;
      pitcherInput.value = "";
      render({ resetScroll: true });
    });

    filtersEl.addEventListener("click", (event) => {
      const button = event.target.closest("[data-facet]");
      if (!button || button.disabled) return;
      const facet = button.dataset.facet;
      const value = button.dataset.value || "";
      if (facet === "audio") state.audio = !state.audio;
      else if (facet === "stills") state.stills = !state.stills;
      else if (facet === "angle") state.angle = state.angle === value ? "" : value;
      else if (facet === "pitch") state.pitch = state.pitch === value ? "" : value;
      else if (facet === "focus") state.focus = state.focus === value ? "" : value;
      render({ resetScroll: true });
    });

    chipsEl.addEventListener("click", (event) => {
      const button = event.target.closest("[data-pitcher]");
      if (!button) return;
      const name = button.dataset.pitcher;
      if (state.pitcher === name) {
        state.pitcher = "";
        state.related = false;
      } else {
        state.pitcher = name;
        const initial = name.charAt(0).toUpperCase();
        if (/^[A-Z]$/.test(initial)) state.letter = initial;
      }
      render({ resetScroll: true });
    });

    selectedEl.addEventListener("click", (event) => {
      if (!event.target.closest(".sel-x")) return;
      state.pitcher = "";
      state.related = false;
      render({ resetScroll: true });
    });

    relatedBtn.addEventListener("click", () => {
      if (relatedBtn.disabled) return;
      state.related = !state.related;
      render({ resetScroll: true });
    });

    gripsEl.addEventListener("click", (event) => {
      const button = event.target.closest("[data-grip]");
      if (!button || button.disabled) return;
      state.grip = button.dataset.grip || "all";
      render({ resetScroll: true });
    });

    foldersEl.addEventListener("click", (event) => {
      const button = event.target.closest("[data-folder]");
      if (!button || button.disabled) return;
      state.folder = button.dataset.folder || "all";
      render({ resetScroll: true });
    });

    grid.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;
      const card = event.target.closest(".card");
      if (!card || !card.dataset.id) return;
      openLightbox(card.dataset.id);
    });

    grid.addEventListener("pointerover", (event) => {
      if (state.autoplay || isLightboxOpen()) return;
      const card = event.target.closest(".card");
      if (!card || card.dataset.type !== "video") return;
      const from = event.relatedTarget && event.relatedTarget.closest ? event.relatedTarget.closest(".card") : null;
      if (from === card) return;
      for (const other of cardEls.values()) {
        if (other !== card && other.querySelector("video")) unmountVideo(other);
      }
      lastKeep = "";
      mountVideo(card);
      scheduleVideos();
    });

    grid.addEventListener("pointerout", (event) => {
      if (state.autoplay) return;
      const card = event.target.closest(".card");
      if (!card) return;
      const to = event.relatedTarget && event.relatedTarget.closest ? event.relatedTarget.closest(".card") : null;
      if (to === card) return;
      unmountVideo(card);
      lastKeep = "";
    });

    loadMoreBtn.addEventListener("click", () => {
      moreChain = 0;
      loadMore(true);
    });

    const moreIO = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      if (!items.length || state.shown >= state.view.length) return;
      loadMore(false);
    }, { root: null, rootMargin: "240px 0px" });
    moreIO.observe(sentinel);

    window.addEventListener("scroll", scheduleVideos, { passive: true });
    window.addEventListener("resize", scheduleVideos);

    lbClose.addEventListener("click", closeLightbox);
    lightbox.addEventListener("click", (event) => {
      if (event.target.closest("[data-close]")) closeLightbox();
    });
    lbPrev.addEventListener("click", () => stepClip(-1));
    lbNext.addEventListener("click", () => stepClip(1));
    lbPlay.addEventListener("click", togglePlay);
    lbBack.addEventListener("click", () => stepFrame(-1));
    lbFwd.addEventListener("click", () => stepFrame(1));
    lbLoop.addEventListener("click", () => {
      state.loop = !state.loop;
      lbLoop.setAttribute("aria-pressed", state.loop ? "true" : "false");
      if (lbVideo) lbVideo.loop = state.loop;
    });
    lbSpeed.addEventListener("click", (event) => {
      const button = event.target.closest("[data-rate]");
      if (!button) return;
      state.rate = Number(button.dataset.rate);
      if (lbVideo) lbVideo.playbackRate = state.rate;
      setSpeedButtons();
    });
    lbMute.addEventListener("click", () => {
      if (!lbVideo) return;
      lbVideo.muted = !lbVideo.muted;
      if (!lbVideo.muted) {
        const pending = lbVideo.play();
        if (pending) {
          pending.catch(() => {
            lbVideo.muted = true;
            lbNote.hidden = false;
            lbNote.textContent = "Playing muted. Unmute to hear audio.";
            syncMute();
          });
        }
      }
      syncMute();
    });
    lbCopy.addEventListener("click", async () => {
      const url = location.href;
      let ok = false;
      try {
        await navigator.clipboard.writeText(url);
        ok = true;
      } catch {
        ok = fallbackCopy(url);
      }
      lbCopy.textContent = ok ? "Copied" : "Copy failed";
      window.clearTimeout(copyTimer);
      copyTimer = window.setTimeout(() => {
        lbCopy.textContent = "Copy clip link";
      }, 1400);
    });

    document.addEventListener("keydown", (event) => {
      const tag = event.target && event.target.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || event.target.isContentEditable;
      if (isLightboxOpen()) {
        if (typing) return;
        if (event.key === "Escape") {
          event.preventDefault();
          closeLightbox();
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          stepClip(-1);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          stepClip(1);
        } else if (event.key === " ") {
          event.preventDefault();
          togglePlay();
        } else if (event.key === "," || event.key === "<") {
          event.preventDefault();
          stepFrame(-1);
        } else if (event.key === "." || event.key === ">") {
          event.preventDefault();
          stepFrame(1);
        } else if (event.key === "Tab") {
          trapFocus(event);
        }
        return;
      }
      if (!typing && event.key === "/") {
        event.preventDefault();
        qInput.focus();
      }
    });

    window.addEventListener("popstate", () => {
      readUrl();
      render({ resetScroll: false, writeHistory: false });
      if (state.clip && byId.has(state.clip)) openLightbox(state.clip);
      else if (isLightboxOpen()) closeLightbox();
    });
  }

  function trapFocus(event) {
    const nodes = [...lbDialog.querySelectorAll("button, a[href], input, video")].filter((el) => {
      if (el.disabled || el.hidden) return false;
      if (el.closest("[hidden]")) return false;
      return true;
    });
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function loadCatalog() {
    showSkeletons();
    try {
      const response = await fetch("catalog.json", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      catalog = await response.json();
      items = Array.isArray(catalog.items) ? catalog.items : [];
      if (!items.length) throw new Error("empty");
      byId.clear();
      for (const item of items) {
        item._hay = haystack(item);
        byId.set(item.id, item);
      }
      const explicitTab = new URLSearchParams(location.search).has("tab");
      if (state.clip && byId.has(state.clip) && !explicitTab) {
        state.tab = byId.get(state.clip).section || state.tab;
      }
      fatalEl.hidden = true;
      libraryEl.setAttribute("aria-busy", "false");
      render({ resetScroll: false });
      renderFooter();
      if (state.clip) {
        if (byId.has(state.clip)) openLightbox(state.clip);
        else {
          state.clip = "";
          writeUrl();
          summaryEl.textContent = `${summaryEl.textContent} · Clip not found in catalog`;
        }
      }
    } catch {
      grid.replaceChildren();
      fatalEl.hidden = false;
      emptyEl.hidden = true;
      countsEl.textContent = "Catalog unavailable";
      libraryEl.setAttribute("aria-busy", "false");
    }
  }

  readUrl();
  state.autoplay = readAutoplayPref();
  state.filtersOpen = !!(state.angle || state.pitch || state.focus || state.audio || state.stills);
  updateAutoplayUI();
  bindEvents();
  loadCatalog();
})();
