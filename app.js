(function () {
  "use strict";

  // ===== Constants =====
  const STORAGE_KEY = "habitracker.habits.v1";
  const SETTINGS_KEY = "habitracker.settings.v1";
  const LOCALE = "fr-FR";
  const WEEKS = 53;
  const MONTH_NAMES = [
    "Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin",
    "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc.",
  ];
  const MONTH_INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  const WEEKDAY_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const WEEKDAY_LETTER = ["D", "L", "M", "M", "J", "V", "S"];
  const WEEKDAY_LONG = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

  const EMOJI_PALETTE = [
    "🎯", "🏃", "📚", "💧", "🧘", "✍️",
    "💪", "🥗", "🛌", "🚭", "🎸", "🎨",
    "🧠", "💊", "🧹", "🦷", "☀️", "📞",
    "💰", "🌱", "🐕", "♟️", "🎮", "⏰",
  ];
  const DEFAULT_EMOJI = "🎯";

  // 8 color choices for habits. Each maps to a single bright tone and a
  // matching contribution-style 4-step palette.
  const COLOR_PALETTE = {
    green:  { base: "#39d353", steps: ["#161b22", "#033a16", "#196c2e", "#2ea043", "#56d364"] },
    blue:   { base: "#58a6ff", steps: ["#161b22", "#0c2d6b", "#1c5fc5", "#388bfd", "#79c0ff"] },
    purple: { base: "#a371f7", steps: ["#161b22", "#3c1a78", "#6e40c9", "#a371f7", "#d2a8ff"] },
    orange: { base: "#fd8c73", steps: ["#161b22", "#7a2e0e", "#bd561d", "#f0883e", "#fdac68"] },
    red:    { base: "#ff6a69", steps: ["#161b22", "#7a1820", "#ad2c35", "#e5534b", "#ff7b72"] },
    pink:   { base: "#f778ba", steps: ["#161b22", "#6a1452", "#b5267d", "#e85aad", "#ff9bce"] },
    teal:   { base: "#2dd4bf", steps: ["#161b22", "#0d3c3a", "#138073", "#1ec0a5", "#56e0c6"] },
    yellow: { base: "#e3b341", steps: ["#161b22", "#5c3f0b", "#9e6a06", "#d4a72c", "#f2cc60"] },
  };
  const DEFAULT_COLOR = "green";

  // Achievements unlocked from streak (consecutive days) or total count.
  const ACHIEVEMENTS = [
    { id: "streak7",   type: "streak", threshold: 7,   icon: "🔥", title: "7 jours de suite" },
    { id: "streak30",  type: "streak", threshold: 30,  icon: "🏆", title: "30 jours de suite" },
    { id: "streak100", type: "streak", threshold: 100, icon: "💎", title: "100 jours de suite" },
    { id: "streak365", type: "streak", threshold: 365, icon: "👑", title: "1 an de suite" },
    { id: "total10",   type: "total",  threshold: 10,  icon: "🌱", title: "10 jours cochés" },
    { id: "total50",   type: "total",  threshold: 50,  icon: "🌿", title: "50 jours cochés" },
    { id: "total100",  type: "total",  threshold: 100, icon: "🌳", title: "100 jours cochés" },
    { id: "total365",  type: "total",  threshold: 365, icon: "🌲", title: "365 jours cochés" },
  ];

  // ===== DOM refs =====
  const $ = (id) => document.getElementById(id);

  const list = $("habitsList");
  const emptyState = $("emptyState");
  const template = $("habitTemplate");
  const tooltip = $("tooltip");
  const todayBadge = $("todayBadge");
  const addBtn = $("addHabitBtn");
  const settingsBtn = $("settingsBtn");

  // Habit modal
  const habitModal = $("modalOverlay");
  const habitForm = $("habitForm");
  const modalTitle = $("modalTitle");
  const modalNameInput = $("habitFormName");
  const emojiGrid = $("emojiGrid");
  const colorGrid = $("colorGrid");
  const targetRange = $("targetRange");
  const targetValue = $("targetValue");
  const pauseToggle = $("pauseToggle");
  const archiveBtn = $("archiveBtn");
  const modalCancel = $("modalCancel");

  // Settings modal
  const settingsModal = $("settingsModal");
  const settingsClose = $("settingsClose");
  const themeRadios = document.querySelectorAll('input[name="theme"]');
  const exportBtn = $("exportBtn");
  const importBtn = $("importBtn");
  const importFile = $("importFile");
  const archivedList = $("archivedList");

  // Note / Day editor modal
  const noteModal = $("noteModal");
  const noteForm = $("noteForm");
  const noteTitle = $("noteTitle");
  const noteInput = $("noteInput");
  const noteCancel = $("noteCancel");
  const noteDelete = $("noteDelete");
  const stateButtons = noteForm.querySelectorAll(".state-btn");

  // Toast & confetti
  const toast = $("toast");
  const toastMessage = $("toastMessage");
  const toastUndo = $("toastUndo");
  const confettiBox = $("confetti");

  // ===== State =====
  let habits = loadHabits();
  let settings = loadSettings();
  let modalState = null;
  let noteState = null; // { habitId, dateKey }
  let undoState = null; // { label, restore: () => void, timer }

  applyTheme(settings.theme);

  // ===== Storage =====
  function loadHabits() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((h, idx) => migrateHabit(h, idx));
    } catch (e) {
      return [];
    }
  }

  function migrateHabit(h, idx) {
    return {
      id: String(h.id),
      name: String(h.name || "Habitude sans nom"),
      emoji: typeof h.emoji === "string" && h.emoji ? h.emoji : DEFAULT_EMOJI,
      color: COLOR_PALETTE[h.color] ? h.color : DEFAULT_COLOR,
      dates: Array.isArray(h.dates) ? h.dates.filter((d) => typeof d === "string") : [],
      notes: h.notes && typeof h.notes === "object" ? { ...h.notes } : {},
      chartPeriod: typeof h.chartPeriod === "string" ? h.chartPeriod : "week",
      weeklyTarget: Number.isInteger(h.weeklyTarget) && h.weeklyTarget >= 1 && h.weeklyTarget <= 7
        ? h.weeklyTarget : 7,
      paused: Boolean(h.paused),
      archived: Boolean(h.archived),
      achievements: Array.isArray(h.achievements) ? h.achievements.filter((a) => typeof a === "string") : [],
      order: Number.isInteger(h.order) ? h.order : idx,
      createdAt: typeof h.createdAt === "string" ? h.createdAt : new Date().toISOString(),
    };
  }

  function saveHabits() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        theme: parsed.theme === "light" ? "light" : "dark",
      };
    } catch (e) {
      return { theme: "dark" };
    }
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#ffffff" : "#0d1117");
  }

  // ===== Date helpers =====
  function dateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function todayKey() { return dateKey(new Date()); }
  function parseKey(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  function addDays(date, days) {
    const d = new Date(date); d.setDate(d.getDate() + days); return d;
  }
  function startOfDay(date) {
    const d = new Date(date); d.setHours(0, 0, 0, 0); return d;
  }
  function startOfWeek(date) {
    const d = startOfDay(date); d.setDate(d.getDate() - d.getDay()); return d;
  }

  // ===== Stats =====
  function computeStreak(dates) {
    const set = new Set(dates);
    let streak = 0;
    let d = startOfDay(new Date());
    if (!set.has(dateKey(d))) d = addDays(d, -1);
    while (set.has(dateKey(d))) { streak++; d = addDays(d, -1); }
    return streak;
  }

  function computeBestStreak(dates) {
    if (!dates.length) return 0;
    const sorted = [...new Set(dates)].sort();
    let best = 1, current = 1;
    for (let i = 1; i < sorted.length; i++) {
      const diff = Math.round((parseKey(sorted[i]) - parseKey(sorted[i - 1])) / 86400000);
      if (diff === 1) { current++; if (current > best) best = current; }
      else { current = 1; }
    }
    return best;
  }

  function weekProgress(habit) {
    // count done days in last 7 days (today inclusive)
    const set = new Set(habit.dates);
    const today = startOfDay(new Date());
    let count = 0;
    for (let i = 0; i < 7; i++) {
      if (set.has(dateKey(addDays(today, -i)))) count++;
    }
    return count;
  }

  function todayCount() {
    const active = habits.filter((h) => !h.archived && !h.paused);
    const t = todayKey();
    const done = active.reduce((n, h) => n + (h.dates.includes(t) ? 1 : 0), 0);
    return { done, total: active.length };
  }

  // ===== Achievements =====
  function evaluateAchievements(habit) {
    const streak = computeBestStreak(habit.dates);
    const total = habit.dates.length;
    const unlocked = new Set(habit.achievements);
    const newly = [];
    ACHIEVEMENTS.forEach((a) => {
      const value = a.type === "streak" ? streak : total;
      if (value >= a.threshold && !unlocked.has(a.id)) {
        unlocked.add(a.id);
        newly.push(a);
      }
    });
    habit.achievements = [...unlocked];
    return newly;
  }

  // ===== Insights =====
  function computeInsights(habit) {
    if (!habit.dates.length) return null;
    // best day of week
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    const dayOccurrences = [0, 0, 0, 0, 0, 0, 0];
    const sorted = [...new Set(habit.dates)].sort();
    const firstDate = parseKey(sorted[0]);
    const today = startOfDay(new Date());

    // Count occurrences of each weekday between firstDate and today
    let cur = startOfDay(firstDate);
    while (cur <= today) {
      dayOccurrences[cur.getDay()]++;
      cur = addDays(cur, 1);
    }
    habit.dates.forEach((k) => {
      const d = parseKey(k);
      dayCounts[d.getDay()]++;
    });

    let bestDay = 0, bestRate = -1;
    for (let i = 0; i < 7; i++) {
      const rate = dayOccurrences[i] ? dayCounts[i] / dayOccurrences[i] : 0;
      if (rate > bestRate) { bestRate = rate; bestDay = i; }
    }

    // This month vs last month
    const tY = today.getFullYear(), tM = today.getMonth();
    const thisMonthDone = habit.dates.filter((k) => {
      const d = parseKey(k);
      return d.getFullYear() === tY && d.getMonth() === tM;
    }).length;

    const lastMonthDate = new Date(tY, tM - 1, 1);
    const lY = lastMonthDate.getFullYear(), lM = lastMonthDate.getMonth();
    const lastMonthDone = habit.dates.filter((k) => {
      const d = parseKey(k);
      return d.getFullYear() === lY && d.getMonth() === lM;
    }).length;

    return {
      bestDay,
      bestRate,
      thisMonthDone,
      lastMonthDone,
      thisMonthLabel: MONTH_NAMES[tM].replace(".", ""),
      lastMonthLabel: MONTH_NAMES[lM].replace(".", ""),
    };
  }

  // ===== Chart =====
  function chartData(habit, period) {
    const set = new Set(habit.dates);
    const today = startOfDay(new Date());
    const buckets = [];
    if (period === "week") {
      for (let i = 6; i >= 0; i--) {
        const d = addDays(today, -i);
        buckets.push({ label: WEEKDAY_LETTER[d.getDay()], value: set.has(dateKey(d)) ? 1 : 0, max: 1 });
      }
    } else if (period === "month") {
      for (let i = 3; i >= 0; i--) {
        const bucketStart = addDays(today, -(i * 7 + 6));
        let count = 0;
        for (let j = 0; j < 7; j++) if (set.has(dateKey(addDays(bucketStart, j)))) count++;
        buckets.push({ label: `${bucketStart.getDate()}/${bucketStart.getMonth() + 1}`, value: count, max: 7 });
      }
    } else if (period === "quarter") {
      for (let i = 11; i >= 0; i--) {
        const bucketStart = addDays(today, -(i * 7 + 6));
        let count = 0;
        for (let j = 0; j < 7; j++) if (set.has(dateKey(addDays(bucketStart, j)))) count++;
        const showLabel = i === 11 || i === 6 || i === 0;
        buckets.push({ label: showLabel ? MONTH_INITIALS[bucketStart.getMonth()] : "", value: count, max: 7 });
      }
    } else if (period === "year") {
      for (let i = 11; i >= 0; i--) {
        const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
        const isCurrent = i === 0;
        const effectiveDays = isCurrent ? today.getDate() : monthEnd.getDate();
        let count = 0;
        for (let day = 1; day <= effectiveDays; day++) {
          const d = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
          if (set.has(dateKey(d))) count++;
        }
        buckets.push({ label: MONTH_INITIALS[monthStart.getMonth()], value: count, max: effectiveDays });
      }
    }
    return buckets;
  }

  function chartCaption(period) {
    switch (period) {
      case "week": return "7 derniers jours";
      case "month": return "4 dernières semaines";
      case "quarter": return "12 dernières semaines";
      case "year": return "12 derniers mois";
      default: return "";
    }
  }

  function colorForRatio(r, colorKey) {
    const steps = COLOR_PALETTE[colorKey || DEFAULT_COLOR].steps;
    if (r <= 0) return steps[0];
    if (r < 0.25) return steps[1];
    if (r < 0.5) return steps[2];
    if (r < 0.85) return steps[3];
    return steps[4];
  }

  function renderChart(svg, buckets, colorKey) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (!buckets.length) return;
    const W = 320, H = 88, labelH = 14, chartH = H - labelH;
    const n = buckets.length;
    const gap = Math.max(2, Math.min(6, 32 / n));
    const barW = (W - gap * (n - 1)) / n;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("preserveAspectRatio", "none");
    const ns = "http://www.w3.org/2000/svg";
    const labelColor = settings.theme === "light" ? "#59636e" : "#7d8590";
    buckets.forEach((b, i) => {
      const ratio = b.max ? b.value / b.max : 0;
      const h = ratio > 0 ? Math.max(3, ratio * (chartH - 4)) : 3;
      const x = i * (barW + gap);
      const y = chartH - h;
      const rect = document.createElementNS(ns, "rect");
      rect.setAttribute("x", x);
      rect.setAttribute("y", y);
      rect.setAttribute("width", barW);
      rect.setAttribute("height", h);
      rect.setAttribute("rx", 2);
      rect.setAttribute("fill", colorForRatio(ratio, colorKey));
      svg.appendChild(rect);
      if (b.label) {
        const text = document.createElementNS(ns, "text");
        text.setAttribute("x", x + barW / 2);
        text.setAttribute("y", H - 3);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-size", "9");
        text.setAttribute("fill", labelColor);
        text.textContent = b.label;
        svg.appendChild(text);
      }
    });
  }

  // ===== Render =====
  function visibleHabits() {
    return habits
      .filter((h) => !h.archived)
      .sort((a, b) => a.order - b.order);
  }

  function render() {
    list.innerHTML = "";
    const visible = visibleHabits();
    if (!visible.length) {
      emptyState.classList.remove("hidden");
      todayBadge.classList.add("hidden");
    } else {
      emptyState.classList.add("hidden");
      visible.forEach((h, idx) => renderHabit(h, idx, visible.length));
      const tc = todayCount();
      todayBadge.textContent = `${tc.done}/${tc.total} aujourd'hui`;
      todayBadge.classList.toggle("complete", tc.done > 0 && tc.done === tc.total);
      todayBadge.classList.remove("hidden");
    }
  }

  function renderHabit(habit, position, total) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.id = habit.id;
    node.dataset.color = habit.color;
    if (habit.paused) node.classList.add("paused");

    const streak = computeStreak(habit.dates);
    const best = computeBestStreak(habit.dates);
    const wp = weekProgress(habit);

    node.querySelector(".habit-emoji").textContent = habit.emoji;
    node.querySelector(".habit-name").textContent = habit.name;
    const pauseTag = node.querySelector(".pause-tag");
    if (habit.paused) pauseTag.classList.remove("hidden");

    node.querySelector(".streak-count").textContent = streak;
    node.querySelector(".streak-label").textContent = streak <= 1 ? "jour" : "jours";
    node.querySelector(".best-count").textContent = best;
    node.querySelector(".total-count").textContent = habit.dates.length;

    // Weekly target progress
    const wpEl = node.querySelector(".week-progress");
    wpEl.textContent = `${Math.min(wp, habit.weeklyTarget)}/${habit.weeklyTarget} cette semaine`;
    if (wp >= habit.weeklyTarget) wpEl.classList.add("met");

    // Reorder buttons
    const upBtn = node.querySelector(".up-btn");
    const downBtn = node.querySelector(".down-btn");
    if (position === 0) upBtn.disabled = true;
    if (position === total - 1) downBtn.disabled = true;
    upBtn.addEventListener("click", () => moveHabit(habit.id, -1));
    downBtn.addEventListener("click", () => moveHabit(habit.id, 1));

    // Action buttons
    node.querySelector(".share-btn").addEventListener("click", () => shareHabit(habit));
    node.querySelector(".edit-btn").addEventListener("click", () =>
      openHabitModal({ mode: "edit", habitId: habit.id })
    );
    node.querySelector(".delete-btn").addEventListener("click", () => {
      if (confirm(`Supprimer « ${habit.emoji} ${habit.name} » ? Cette action est irréversible.`)) {
        deleteHabit(habit.id);
      }
    });

    // Achievements row
    renderAchievements(node, habit);
    // Insights
    renderInsights(node, habit);

    buildWeekStrip(node, habit);
    buildChart(node, habit);
    buildGrid(node, habit);

    list.appendChild(node);
  }

  function renderAchievements(node, habit) {
    const row = node.querySelector(".achievements");
    row.innerHTML = "";
    const unlocked = new Set(habit.achievements);
    ACHIEVEMENTS.forEach((a) => {
      const span = document.createElement("span");
      span.className = "achievement" + (unlocked.has(a.id) ? " unlocked" : "");
      span.title = a.title;
      span.setAttribute("aria-label", a.title);
      span.textContent = a.icon;
      row.appendChild(span);
    });
  }

  function renderInsights(node, habit) {
    const summary = node.querySelector(".insights-summary");
    const body = node.querySelector(".insights-body");
    const insights = computeInsights(habit);
    if (!insights) {
      summary.textContent = "Coche quelques jours pour voir tes tendances.";
      body.innerHTML = "";
      return;
    }
    summary.textContent = `Meilleur jour : ${WEEKDAY_LONG[insights.bestDay]} · ${insights.thisMonthLabel} ${insights.thisMonthDone} cochés`;
    const diff = insights.thisMonthDone - insights.lastMonthDone;
    const diffLabel = diff === 0 ? "stable" : (diff > 0 ? `+${diff}` : `${diff}`);
    body.innerHTML = `
      <ul>
        <li><strong>${WEEKDAY_LONG[insights.bestDay]}</strong> est ton meilleur jour
          (${Math.round(insights.bestRate * 100)} % de réussite).</li>
        <li>${insights.thisMonthLabel} : <strong>${insights.thisMonthDone}</strong> jours cochés
          (${diffLabel} vs ${insights.lastMonthLabel}, ${insights.lastMonthDone}).</li>
        <li>Total cumulé : <strong>${habit.dates.length}</strong> jours sur
          ${Math.ceil((new Date() - parseKey([...habit.dates].sort()[0])) / 86400000) + 1} jours suivis.</li>
      </ul>`;
  }

  function buildWeekStrip(node, habit) {
    const strip = node.querySelector(".week-strip");
    strip.innerHTML = "";
    const today = startOfDay(new Date());
    const set = new Set(habit.dates);
    const colorBase = COLOR_PALETTE[habit.color].base;

    for (let i = 6; i >= 0; i--) {
      const d = addDays(today, -i);
      const key = dateKey(d);
      const isToday = i === 0;
      const done = set.has(key);
      const hasNote = Boolean(habit.notes[key]);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "week-day";
      if (done) btn.classList.add("done");
      if (isToday) btn.classList.add("today");
      if (done) btn.style.background = colorBase;
      btn.setAttribute("aria-label",
        `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${done ? "fait" : "non fait"}`
      );

      const nameEl = document.createElement("span");
      nameEl.className = "day-name";
      nameEl.textContent = isToday ? "Auj." : WEEKDAY_SHORT[d.getDay()];

      const numEl = document.createElement("span");
      numEl.className = "day-num";
      numEl.textContent = d.getDate();

      const markEl = document.createElement("span");
      markEl.className = "day-mark";
      markEl.textContent = done ? "✓" : "";

      btn.appendChild(nameEl);
      btn.appendChild(numEl);
      btn.appendChild(markEl);

      if (hasNote) {
        const dot = document.createElement("span");
        dot.className = "note-dot";
        btn.appendChild(dot);
      }

      attachTapOrLongPress(btn,
        () => toggleDay(habit.id, key),
        () => openNoteModal(habit.id, key)
      );
      strip.appendChild(btn);
    }
  }

  function buildChart(node, habit) {
    const tabs = node.querySelectorAll(".chart-tab");
    const svg = node.querySelector(".chart-svg");
    const caption = node.querySelector(".chart-caption");
    const draw = (p) => {
      tabs.forEach((t) => t.classList.toggle("active", t.dataset.period === p));
      caption.textContent = chartCaption(p);
      renderChart(svg, chartData(habit, p), habit.color);
    };
    tabs.forEach((t) => {
      t.addEventListener("click", () => {
        habit.chartPeriod = t.dataset.period;
        saveHabits();
        draw(habit.chartPeriod);
      });
    });
    draw(habit.chartPeriod || "week");
  }

  function buildGrid(node, habit) {
    const grid = node.querySelector(".grid");
    const monthLabels = node.querySelector(".month-labels");
    const legend = node.querySelector(".legend");
    grid.innerHTML = "";
    monthLabels.innerHTML = "";

    // Update legend swatches for habit color
    const steps = COLOR_PALETTE[habit.color].steps;
    legend.querySelectorAll(".day-cell").forEach((cell, i) => {
      cell.style.background = steps[i] || steps[steps.length - 1];
    });

    const today = startOfDay(new Date());
    const endWeekStart = startOfWeek(today);
    const startWeek = addDays(endWeekStart, -(WEEKS - 1) * 7);
    const doneSet = new Set(habit.dates);
    const monthsSeen = new Set();
    const colorBase = COLOR_PALETTE[habit.color].base;

    for (let w = 0; w < WEEKS; w++) {
      const weekStart = addDays(startWeek, w * 7);
      const monthKey = `${weekStart.getFullYear()}-${weekStart.getMonth()}`;
      if (!monthsSeen.has(monthKey) && weekStart.getDate() <= 7) {
        monthsSeen.add(monthKey);
        const span = document.createElement("span");
        span.textContent = MONTH_NAMES[weekStart.getMonth()].replace(".", "");
        span.style.gridColumn = w + 1;
        monthLabels.appendChild(span);
      }
      for (let day = 0; day < 7; day++) {
        const cell = document.createElement("div");
        cell.className = "day-cell";
        const cellDate = startOfDay(addDays(weekStart, day));
        if (cellDate > today) {
          cell.classList.add("future");
          cell.setAttribute("aria-hidden", "true");
        } else {
          const key = dateKey(cellDate);
          const done = doneSet.has(key);
          if (done) cell.style.background = colorBase;
          if (habit.notes[key]) cell.classList.add("has-note");
          cell.dataset.date = key;
          cell.addEventListener("click", () => openNoteModal(habit.id, key));
          cell.addEventListener("mouseenter", (e) => showTooltip(e, key, done, habit));
          cell.addEventListener("mousemove", moveTooltip);
          cell.addEventListener("mouseleave", hideTooltip);
        }
        grid.appendChild(cell);
      }
    }
  }

  // ===== Interactions =====
  function toggleDay(habitId, key) {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;
    if (parseKey(key) > new Date()) return;
    const idx = habit.dates.indexOf(key);
    const wasDone = idx >= 0;
    if (wasDone) habit.dates.splice(idx, 1);
    else habit.dates.push(key);
    haptic();
    saveHabits();

    // Check achievements only when marking as done
    let newAchievements = [];
    if (!wasDone) newAchievements = evaluateAchievements(habit);
    saveHabits();
    render();

    // Show undo
    showUndo(
      wasDone ? "Jour décoché" : "Jour coché",
      () => {
        if (wasDone) habit.dates.push(key);
        else {
          const i = habit.dates.indexOf(key);
          if (i >= 0) habit.dates.splice(i, 1);
        }
        // Re-evaluate achievements is intentionally skipped: unlocked stays unlocked.
        saveHabits();
        render();
      }
    );

    // Celebrate
    if (newAchievements.length) {
      fireConfetti();
      flash(`${newAchievements[0].icon} ${newAchievements[0].title} débloqué !`);
    } else if (!wasDone) {
      const tc = todayCount();
      if (tc.done > 0 && tc.done === tc.total && key === todayKey()) {
        fireConfetti();
      }
    }
  }

  function deleteHabit(id) {
    const idx = habits.findIndex((h) => h.id === id);
    if (idx < 0) return;
    const snapshot = JSON.parse(JSON.stringify(habits[idx]));
    habits.splice(idx, 1);
    saveHabits();
    render();
    showUndo(`Habitude supprimée`, () => {
      habits.push(snapshot);
      reindex();
      saveHabits();
      render();
    });
  }

  function moveHabit(id, delta) {
    const visible = visibleHabits();
    const idx = visible.findIndex((h) => h.id === id);
    const swapWith = visible[idx + delta];
    if (!swapWith) return;
    const habit = visible[idx];
    [habit.order, swapWith.order] = [swapWith.order, habit.order];
    saveHabits();
    render();
  }

  function reindex() {
    visibleHabits().forEach((h, i) => { h.order = i; });
  }

  // ===== Tap vs long-press =====
  function attachTapOrLongPress(el, onTap, onLongPress) {
    let timer = null;
    let isLongPress = false;
    let cancelled = false;
    let startX = 0, startY = 0;
    const THRESHOLD_MS = 450;
    const MOVE_TOLERANCE = 10;

    const start = (x, y) => {
      isLongPress = false;
      cancelled = false;
      startX = x; startY = y;
      timer = setTimeout(() => {
        isLongPress = true;
        haptic(20);
        onLongPress();
      }, THRESHOLD_MS);
    };
    const move = (x, y) => {
      if (cancelled) return;
      if (Math.abs(x - startX) > MOVE_TOLERANCE || Math.abs(y - startY) > MOVE_TOLERANCE) {
        cancelled = true;
        if (timer) { clearTimeout(timer); timer = null; }
      }
    };
    const end = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      if (!isLongPress && !cancelled) onTap();
    };
    const cancel = () => {
      cancelled = true;
      if (timer) { clearTimeout(timer); timer = null; }
    };

    el.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      start(t.clientX, t.clientY);
    }, { passive: true });
    el.addEventListener("touchmove", (e) => {
      const t = e.touches[0];
      move(t.clientX, t.clientY);
    }, { passive: true });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", cancel);

    // Mouse: use a plain click for desktop. Touch devices already handled above.
    el.addEventListener("click", (e) => {
      if (e.detail === 0) return; // synthetic
      if (window.matchMedia("(hover: hover)").matches) onTap();
    });
  }

  function haptic(ms = 8) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  // ===== Tooltip =====
  function showTooltip(e, key, done, habit) {
    const d = parseKey(key);
    const formatted = d.toLocaleDateString(LOCALE, {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    let txt = done ? `Fait · ${formatted}` : `Rien · ${formatted}`;
    if (habit.notes[key]) txt += ` — “${habit.notes[key]}”`;
    tooltip.textContent = txt;
    tooltip.classList.remove("hidden");
    moveTooltip(e);
  }
  function moveTooltip(e) {
    const offset = 12;
    let x = e.clientX + offset, y = e.clientY + offset;
    const rect = tooltip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - 8) x = e.clientX - rect.width - offset;
    if (y + rect.height > window.innerHeight - 8) y = e.clientY - rect.height - offset;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }
  function hideTooltip() { tooltip.classList.add("hidden"); }

  // ===== Habit modal =====
  function buildEmojiGrid() {
    emojiGrid.innerHTML = "";
    EMOJI_PALETTE.forEach((e) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "emoji-btn";
      btn.textContent = e;
      btn.addEventListener("click", () => {
        if (!modalState) return;
        modalState.emoji = e;
        updateEmojiSelection();
      });
      emojiGrid.appendChild(btn);
    });
  }

  function buildColorGrid() {
    colorGrid.innerHTML = "";
    Object.entries(COLOR_PALETTE).forEach(([key, palette]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "color-btn";
      btn.dataset.color = key;
      btn.style.background = palette.base;
      btn.setAttribute("aria-label", key);
      btn.addEventListener("click", () => {
        if (!modalState) return;
        modalState.color = key;
        updateColorSelection();
      });
      colorGrid.appendChild(btn);
    });
  }

  function updateEmojiSelection() {
    if (!modalState) return;
    emojiGrid.querySelectorAll(".emoji-btn").forEach((b) => {
      b.classList.toggle("selected", b.textContent === modalState.emoji);
    });
  }

  function updateColorSelection() {
    if (!modalState) return;
    colorGrid.querySelectorAll(".color-btn").forEach((b) => {
      b.classList.toggle("selected", b.dataset.color === modalState.color);
    });
  }

  function updateTargetDisplay() {
    if (!modalState) return;
    targetValue.textContent = modalState.weeklyTarget === 7
      ? "Tous les jours"
      : `${modalState.weeklyTarget}× par semaine`;
  }

  function openHabitModal({ mode, habitId }) {
    if (mode === "create") {
      modalState = {
        mode,
        emoji: DEFAULT_EMOJI,
        color: DEFAULT_COLOR,
        weeklyTarget: 7,
        paused: false,
      };
      modalTitle.textContent = "Nouvelle habitude";
      modalNameInput.value = "";
      archiveBtn.classList.add("hidden");
    } else {
      const habit = habits.find((h) => h.id === habitId);
      if (!habit) return;
      modalState = {
        mode, habitId,
        emoji: habit.emoji,
        color: habit.color,
        weeklyTarget: habit.weeklyTarget,
        paused: habit.paused,
      };
      modalTitle.textContent = "Modifier l'habitude";
      modalNameInput.value = habit.name;
      archiveBtn.classList.remove("hidden");
    }
    targetRange.value = String(modalState.weeklyTarget);
    pauseToggle.checked = modalState.paused;
    updateEmojiSelection();
    updateColorSelection();
    updateTargetDisplay();
    showModal(habitModal);
    setTimeout(() => modalNameInput.focus(), 50);
  }

  function closeHabitModal() {
    hideModal(habitModal);
    modalState = null;
  }

  habitForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!modalState) return;
    const name = modalNameInput.value.trim();
    if (!name) return;
    if (modalState.mode === "create") {
      const order = habits.length ? Math.max(...habits.map((h) => h.order)) + 1 : 0;
      habits.push({
        id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
        name,
        emoji: modalState.emoji,
        color: modalState.color,
        dates: [],
        notes: {},
        chartPeriod: "week",
        weeklyTarget: modalState.weeklyTarget,
        paused: modalState.paused,
        archived: false,
        achievements: [],
        order,
        createdAt: new Date().toISOString(),
      });
    } else {
      const habit = habits.find((h) => h.id === modalState.habitId);
      if (habit) {
        habit.name = name;
        habit.emoji = modalState.emoji;
        habit.color = modalState.color;
        habit.weeklyTarget = modalState.weeklyTarget;
        habit.paused = modalState.paused;
      }
    }
    closeHabitModal();
    saveHabits();
    render();
  });

  targetRange.addEventListener("input", () => {
    if (!modalState) return;
    modalState.weeklyTarget = parseInt(targetRange.value, 10);
    updateTargetDisplay();
  });

  pauseToggle.addEventListener("change", () => {
    if (!modalState) return;
    modalState.paused = pauseToggle.checked;
  });

  archiveBtn.addEventListener("click", () => {
    if (!modalState || modalState.mode !== "edit") return;
    const habit = habits.find((h) => h.id === modalState.habitId);
    if (!habit) return;
    if (!confirm(`Archiver « ${habit.emoji} ${habit.name} » ? Tu pourras la restaurer depuis les réglages.`)) return;
    habit.archived = true;
    saveHabits();
    closeHabitModal();
    render();
    flash("Habitude archivée");
  });

  modalCancel.addEventListener("click", closeHabitModal);
  habitModal.addEventListener("click", (e) => { if (e.target === habitModal) closeHabitModal(); });

  // ===== Day editor modal (state toggle + note) =====
  function openNoteModal(habitId, key) {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;
    const date = parseKey(key);
    const isFuture = date > new Date();
    const done = habit.dates.includes(key);

    noteState = { habitId, dateKey: key, done };
    noteTitle.textContent = date.toLocaleDateString(LOCALE, {
      weekday: "long", day: "numeric", month: "long",
    });
    noteInput.value = habit.notes[key] || "";
    noteDelete.classList.toggle("hidden", !habit.notes[key]);

    stateButtons.forEach((b) => {
      b.disabled = isFuture;
    });
    updateStateButtons();
    showModal(noteModal);
  }

  function updateStateButtons() {
    if (!noteState) return;
    stateButtons.forEach((b) => {
      b.classList.toggle("active", String(noteState.done) === b.dataset.state);
    });
  }

  stateButtons.forEach((b) => {
    b.addEventListener("click", () => {
      if (!noteState) return;
      noteState.done = b.dataset.state === "true";
      updateStateButtons();
      haptic();
    });
  });

  function closeNoteModal() { hideModal(noteModal); noteState = null; }

  noteForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!noteState) return;
    const habit = habits.find((h) => h.id === noteState.habitId);
    if (!habit) return;

    const key = noteState.dateKey;
    const text = noteInput.value.trim();
    const wasDone = habit.dates.includes(key);
    const wantDone = noteState.done;
    let newAchievements = [];

    if (wantDone && !wasDone) {
      habit.dates.push(key);
      newAchievements = evaluateAchievements(habit);
    } else if (!wantDone && wasDone) {
      const idx = habit.dates.indexOf(key);
      if (idx >= 0) habit.dates.splice(idx, 1);
    }

    if (text) habit.notes[key] = text;
    else delete habit.notes[key];

    closeNoteModal();
    saveHabits();
    render();

    if (newAchievements.length) {
      fireConfetti();
      flash(`${newAchievements[0].icon} ${newAchievements[0].title} débloqué !`);
    } else if (wantDone && !wasDone) {
      const tc = todayCount();
      if (tc.done > 0 && tc.done === tc.total && key === todayKey()) {
        fireConfetti();
      }
    }
  });

  noteCancel.addEventListener("click", closeNoteModal);
  noteDelete.addEventListener("click", () => {
    if (!noteState) return;
    const habit = habits.find((h) => h.id === noteState.habitId);
    if (!habit) return;
    delete habit.notes[noteState.dateKey];
    saveHabits();
    noteDelete.classList.add("hidden");
    noteInput.value = "";
  });
  noteModal.addEventListener("click", (e) => { if (e.target === noteModal) closeNoteModal(); });

  // ===== Settings modal =====
  function openSettings() {
    themeRadios.forEach((r) => { r.checked = r.value === settings.theme; });
    renderArchivedList();
    showModal(settingsModal);
  }
  function closeSettings() { hideModal(settingsModal); }

  themeRadios.forEach((r) => {
    r.addEventListener("change", () => {
      if (!r.checked) return;
      settings.theme = r.value;
      saveSettings();
      applyTheme(settings.theme);
      render();
    });
  });

  function renderArchivedList() {
    archivedList.innerHTML = "";
    const archived = habits.filter((h) => h.archived);
    if (!archived.length) {
      archivedList.innerHTML = `<p class="muted">Aucune habitude archivée.</p>`;
      return;
    }
    archived.forEach((h) => {
      const row = document.createElement("div");
      row.className = "archived-row";
      row.innerHTML = `
        <span class="archived-name">${h.emoji} ${escapeHtml(h.name)}</span>
        <div class="archived-actions">
          <button type="button" class="btn restore-btn">Restaurer</button>
          <button type="button" class="btn btn-danger forget-btn">Supprimer</button>
        </div>`;
      row.querySelector(".restore-btn").addEventListener("click", () => {
        h.archived = false;
        const maxOrder = habits.length ? Math.max(...habits.map((x) => x.order)) : 0;
        h.order = maxOrder + 1;
        saveHabits();
        renderArchivedList();
        render();
      });
      row.querySelector(".forget-btn").addEventListener("click", () => {
        if (!confirm(`Supprimer définitivement « ${h.name} » ?`)) return;
        habits = habits.filter((x) => x.id !== h.id);
        saveHabits();
        renderArchivedList();
        render();
      });
      archivedList.appendChild(row);
    });
  }

  // Export / Import
  exportBtn.addEventListener("click", () => {
    const data = { exportedAt: new Date().toISOString(), habits };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `habitracker-${todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  });

  importBtn.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", async () => {
    const file = importFile.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const incoming = Array.isArray(parsed) ? parsed : parsed.habits;
      if (!Array.isArray(incoming)) throw new Error("invalid");
      if (!confirm(`Importer ${incoming.length} habitude(s) ? Cela remplacera tes données actuelles.`)) {
        importFile.value = "";
        return;
      }
      habits = incoming.map((h, i) => migrateHabit(h, i));
      saveHabits();
      render();
      renderArchivedList();
      flash(`${habits.length} habitude(s) importée(s)`);
    } catch (e) {
      alert("Fichier invalide.");
    }
    importFile.value = "";
  });

  settingsBtn.addEventListener("click", openSettings);
  settingsClose.addEventListener("click", closeSettings);
  settingsModal.addEventListener("click", (e) => { if (e.target === settingsModal) closeSettings(); });

  // ===== Modal helpers =====
  function showModal(m) {
    m.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }
  function hideModal(m) {
    m.classList.add("hidden");
    if (![habitModal, noteModal, settingsModal].some((x) => !x.classList.contains("hidden"))) {
      document.body.classList.remove("modal-open");
    }
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    [habitModal, noteModal, settingsModal].forEach((m) => {
      if (!m.classList.contains("hidden")) m.classList.add("hidden");
    });
    document.body.classList.remove("modal-open");
  });

  // ===== Toast =====
  function showUndo(label, restore) {
    if (undoState && undoState.timer) clearTimeout(undoState.timer);
    undoState = {
      label, restore,
      timer: setTimeout(() => hideToast(), 4000),
    };
    toastMessage.textContent = label;
    toast.classList.remove("hidden");
    toastUndo.onclick = () => {
      restore();
      hideToast();
    };
  }
  function hideToast() {
    toast.classList.add("hidden");
    if (undoState && undoState.timer) clearTimeout(undoState.timer);
    undoState = null;
  }

  function flash(message) {
    toastMessage.textContent = message;
    toastUndo.onclick = null;
    toast.classList.remove("hidden");
    toast.classList.add("no-undo");
    if (undoState && undoState.timer) clearTimeout(undoState.timer);
    undoState = { timer: setTimeout(() => {
      hideToast();
      toast.classList.remove("no-undo");
    }, 2500) };
  }

  // ===== Confetti =====
  function fireConfetti() {
    const colors = ["#39d353", "#58a6ff", "#a371f7", "#fd8c73", "#f778ba", "#2dd4bf", "#e3b341"];
    const N = 50;
    for (let i = 0; i < N; i++) {
      const span = document.createElement("span");
      span.className = "confetti-piece";
      span.style.background = colors[Math.floor(Math.random() * colors.length)];
      span.style.left = Math.random() * 100 + "%";
      span.style.setProperty("--tx", (Math.random() * 200 - 100) + "px");
      span.style.setProperty("--rot", Math.random() * 720 + "deg");
      span.style.setProperty("--dur", (1.2 + Math.random() * 0.8) + "s");
      span.style.setProperty("--delay", (Math.random() * 0.2) + "s");
      confettiBox.appendChild(span);
      setTimeout(() => span.remove(), 2200);
    }
  }

  // ===== Share as PNG =====
  async function shareHabit(habit) {
    const W = 1080, H = 1080;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    const isLight = settings.theme === "light";
    const bg = isLight ? "#ffffff" : "#0d1117";
    const fg = isLight ? "#1f2328" : "#e6edf3";
    const muted = isLight ? "#59636e" : "#7d8590";
    const border = isLight ? "#d0d7de" : "#30363d";
    const colorBase = COLOR_PALETTE[habit.color].base;
    const steps = COLOR_PALETTE[habit.color].steps;

    // bg
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // border card
    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    roundRect(ctx, 40, 40, W - 80, H - 80, 24);
    ctx.stroke();

    // emoji
    ctx.font = "180px -apple-system, 'Apple Color Emoji', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(habit.emoji, W / 2, 200);

    // name
    ctx.font = "600 64px -apple-system, sans-serif";
    ctx.fillStyle = fg;
    ctx.fillText(habit.name, W / 2, 330);

    // stat tiles
    const streak = computeStreak(habit.dates);
    const best = computeBestStreak(habit.dates);
    const total = habit.dates.length;
    const stats = [
      { label: "Suite", value: streak, unit: streak <= 1 ? "jour" : "jours" },
      { label: "Record", value: best, unit: "jours" },
      { label: "Total", value: total, unit: "cochés" },
    ];
    const tileW = (W - 80 - 32 * 2 - 100) / 3;
    const tileH = 200;
    const tileY = 410;
    stats.forEach((s, i) => {
      const x = 90 + i * (tileW + 32);
      ctx.strokeStyle = border;
      ctx.fillStyle = isLight ? "#f6f8fa" : "#010409";
      roundRect(ctx, x, tileY, tileW, tileH, 16);
      ctx.fill();
      ctx.stroke();
      ctx.font = "500 28px -apple-system, sans-serif";
      ctx.fillStyle = muted;
      ctx.fillText(s.label.toUpperCase(), x + tileW / 2, tileY + 40);
      ctx.font = "600 88px -apple-system, sans-serif";
      ctx.fillStyle = fg;
      ctx.fillText(String(s.value), x + tileW / 2, tileY + 110);
      ctx.font = "400 28px -apple-system, sans-serif";
      ctx.fillStyle = muted;
      ctx.fillText(s.unit, x + tileW / 2, tileY + 170);
    });

    // heatmap
    const gridX = 90, gridY = 700;
    const cell = 16, gap = 3;
    const today = startOfDay(new Date());
    const endWeekStart = startOfWeek(today);
    const startWeek = addDays(endWeekStart, -(WEEKS - 1) * 7);
    const doneSet = new Set(habit.dates);
    for (let w = 0; w < WEEKS; w++) {
      for (let d = 0; d < 7; d++) {
        const cellDate = startOfDay(addDays(startWeek, w * 7 + d));
        const x = gridX + w * (cell + gap);
        const y = gridY + d * (cell + gap);
        let color = steps[0];
        if (cellDate > today) color = steps[0];
        else if (doneSet.has(dateKey(cellDate))) color = colorBase;
        ctx.fillStyle = color;
        roundRect(ctx, x, y, cell, cell, 3);
        ctx.fill();
      }
    }

    // footer
    ctx.font = "500 28px -apple-system, sans-serif";
    ctx.fillStyle = muted;
    ctx.textAlign = "center";
    ctx.fillText("Habitracker", W / 2, H - 60);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `habitracker-${habit.name}.png`, { type: "image/png" });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: habit.name });
          return;
        }
      } catch (e) { /* fall back to download */ }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
    }, "image/png");
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ===== Utils =====
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // ===== Init =====
  addBtn.addEventListener("click", () => openHabitModal({ mode: "create" }));
  buildEmojiGrid();
  buildColorGrid();
  // Reconcile any achievements that were earned before this code existed
  habits.forEach((h) => { evaluateAchievements(h); });
  saveHabits();
  render();
})();
