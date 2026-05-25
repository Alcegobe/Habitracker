(function () {
  "use strict";

  const STORAGE_KEY = "habitracker.habits.v1";
  const LOCALE = "fr-FR";
  const WEEKS = 53;
  const MONTH_NAMES = [
    "Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin",
    "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc.",
  ];
  const MONTH_INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  const WEEKDAY_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const WEEKDAY_LETTER = ["D", "L", "M", "M", "J", "V", "S"];

  const EMOJI_PALETTE = [
    "🎯", "🏃", "📚", "💧", "🧘", "✍️",
    "💪", "🥗", "🛌", "🚭", "🎸", "🎨",
    "🧠", "💊", "🧹", "🦷", "☀️", "📞",
    "💰", "🌱", "🐕", "♟️", "🎮", "⏰",
  ];
  const DEFAULT_EMOJI = "🎯";

  const list = document.getElementById("habitsList");
  const emptyState = document.getElementById("emptyState");
  const template = document.getElementById("habitTemplate");
  const tooltip = document.getElementById("tooltip");
  const todayBadge = document.getElementById("todayBadge");
  const addBtn = document.getElementById("addHabitBtn");
  const modal = document.getElementById("modalOverlay");
  const modalTitle = document.getElementById("modalTitle");
  const modalNameInput = document.getElementById("habitFormName");
  const emojiGrid = document.getElementById("emojiGrid");
  const modalCancel = document.getElementById("modalCancel");
  const habitForm = document.getElementById("habitForm");

  let habits = loadHabits();
  let modalState = null;

  // === Storage ===
  function loadHabits() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((h) => ({
        id: String(h.id),
        name: String(h.name || "Habitude sans nom"),
        emoji: typeof h.emoji === "string" && h.emoji ? h.emoji : DEFAULT_EMOJI,
        dates: Array.isArray(h.dates) ? h.dates.filter((d) => typeof d === "string") : [],
        chartPeriod: typeof h.chartPeriod === "string" ? h.chartPeriod : "week",
      }));
    } catch (e) {
      return [];
    }
  }

  function saveHabits() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
  }

  // === Date helpers ===
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
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function startOfWeek(date) {
    const d = startOfDay(date);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }

  // === Stats ===
  function computeStreak(dates) {
    const set = new Set(dates);
    let streak = 0;
    let d = startOfDay(new Date());
    if (!set.has(dateKey(d))) d = addDays(d, -1);
    while (set.has(dateKey(d))) {
      streak++;
      d = addDays(d, -1);
    }
    return streak;
  }

  function computeBestStreak(dates) {
    if (!dates.length) return 0;
    const sorted = [...new Set(dates)].sort();
    let best = 1;
    let current = 1;
    for (let i = 1; i < sorted.length; i++) {
      const diff = Math.round((parseKey(sorted[i]) - parseKey(sorted[i - 1])) / 86400000);
      if (diff === 1) {
        current++;
        if (current > best) best = current;
      } else {
        current = 1;
      }
    }
    return best;
  }

  function todayCount() {
    const t = todayKey();
    const done = habits.reduce((n, h) => n + (h.dates.includes(t) ? 1 : 0), 0);
    return { done, total: habits.length };
  }

  // === Chart ===
  function chartData(habit, period) {
    const set = new Set(habit.dates);
    const today = startOfDay(new Date());
    const buckets = [];

    if (period === "week") {
      for (let i = 6; i >= 0; i--) {
        const d = addDays(today, -i);
        buckets.push({
          label: WEEKDAY_LETTER[d.getDay()],
          value: set.has(dateKey(d)) ? 1 : 0,
          max: 1,
        });
      }
    } else if (period === "month") {
      for (let i = 3; i >= 0; i--) {
        const bucketStart = addDays(today, -(i * 7 + 6));
        let count = 0;
        for (let j = 0; j < 7; j++) {
          if (set.has(dateKey(addDays(bucketStart, j)))) count++;
        }
        buckets.push({
          label: `${bucketStart.getDate()}/${bucketStart.getMonth() + 1}`,
          value: count,
          max: 7,
        });
      }
    } else if (period === "quarter") {
      for (let i = 11; i >= 0; i--) {
        const bucketStart = addDays(today, -(i * 7 + 6));
        let count = 0;
        for (let j = 0; j < 7; j++) {
          if (set.has(dateKey(addDays(bucketStart, j)))) count++;
        }
        // Label every 3rd bucket (oldest, middle, latest)
        const showLabel = i === 11 || i === 6 || i === 0;
        buckets.push({
          label: showLabel ? MONTH_INITIALS[bucketStart.getMonth()] : "",
          value: count,
          max: 7,
        });
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
        buckets.push({
          label: MONTH_INITIALS[monthStart.getMonth()],
          value: count,
          max: effectiveDays,
        });
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

  function colorForRatio(r) {
    if (r === 0) return "#161b22";
    if (r < 0.25) return "#0e4429";
    if (r < 0.5) return "#006d32";
    if (r < 0.85) return "#26a641";
    return "#39d353";
  }

  function renderChart(svg, buckets) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (!buckets.length) return;

    const W = 320;
    const H = 88;
    const labelH = 14;
    const chartH = H - labelH;
    const n = buckets.length;
    const gap = Math.max(2, Math.min(6, 32 / n));
    const barW = (W - gap * (n - 1)) / n;

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("preserveAspectRatio", "none");

    const ns = "http://www.w3.org/2000/svg";

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
      rect.setAttribute("fill", colorForRatio(ratio));
      svg.appendChild(rect);

      if (b.label) {
        const text = document.createElementNS(ns, "text");
        text.setAttribute("x", x + barW / 2);
        text.setAttribute("y", H - 3);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-size", "9");
        text.setAttribute("fill", "#7d8590");
        text.textContent = b.label;
        svg.appendChild(text);
      }
    });
  }

  // === Render ===
  function render() {
    list.innerHTML = "";
    if (!habits.length) {
      emptyState.classList.remove("hidden");
      todayBadge.classList.add("hidden");
    } else {
      emptyState.classList.add("hidden");
      habits.forEach(renderHabit);
      const tc = todayCount();
      todayBadge.textContent = `${tc.done}/${tc.total} aujourd'hui`;
      todayBadge.classList.toggle("complete", tc.done > 0 && tc.done === tc.total);
      todayBadge.classList.remove("hidden");
    }
  }

  function renderHabit(habit) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.id = habit.id;

    const streak = computeStreak(habit.dates);
    const best = computeBestStreak(habit.dates);

    node.querySelector(".habit-emoji").textContent = habit.emoji;
    node.querySelector(".habit-name").textContent = habit.name;
    node.querySelector(".streak-count").textContent = streak;
    node.querySelector(".streak-label").textContent = streak <= 1 ? "jour" : "jours";
    node.querySelector(".best-count").textContent = best;
    node.querySelector(".total-count").textContent = habit.dates.length;

    node.querySelector(".edit-btn").addEventListener("click", () =>
      openModal({ mode: "edit", habitId: habit.id })
    );
    node.querySelector(".delete-btn").addEventListener("click", () => {
      if (confirm(`Supprimer « ${habit.emoji} ${habit.name} » ? Cette action est irréversible.`)) {
        deleteHabit(habit.id);
      }
    });

    buildWeekStrip(node, habit);
    buildChart(node, habit);
    buildGrid(node, habit);

    list.appendChild(node);
  }

  function buildWeekStrip(node, habit) {
    const strip = node.querySelector(".week-strip");
    strip.innerHTML = "";
    const today = startOfDay(new Date());
    const set = new Set(habit.dates);

    for (let i = 6; i >= 0; i--) {
      const d = addDays(today, -i);
      const key = dateKey(d);
      const isToday = i === 0;
      const done = set.has(key);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "week-day";
      if (done) btn.classList.add("done");
      if (isToday) btn.classList.add("today");
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
      btn.addEventListener("click", () => toggleDay(habit.id, key));
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
      renderChart(svg, chartData(habit, p));
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
    grid.innerHTML = "";
    monthLabels.innerHTML = "";

    const today = startOfDay(new Date());
    const endWeekStart = startOfWeek(today);
    const startWeek = addDays(endWeekStart, -(WEEKS - 1) * 7);
    const doneSet = new Set(habit.dates);
    const monthsSeen = new Set();

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
          cell.classList.add("future", "dot-l0");
          cell.setAttribute("aria-hidden", "true");
        } else {
          const key = dateKey(cellDate);
          const done = doneSet.has(key);
          cell.classList.add(done ? "dot-l4" : "dot-l0");
          cell.dataset.date = key;
          cell.addEventListener("click", () => toggleDay(habit.id, key));
          cell.addEventListener("mouseenter", (e) => showTooltip(e, key, done));
          cell.addEventListener("mousemove", moveTooltip);
          cell.addEventListener("mouseleave", hideTooltip);
        }
        grid.appendChild(cell);
      }
    }
  }

  function toggleDay(habitId, key) {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;
    if (parseKey(key) > new Date()) return;
    const idx = habit.dates.indexOf(key);
    if (idx >= 0) habit.dates.splice(idx, 1);
    else habit.dates.push(key);
    saveHabits();
    render();
  }

  function deleteHabit(id) {
    habits = habits.filter((h) => h.id !== id);
    saveHabits();
    render();
  }

  // === Tooltip (desktop only really) ===
  function showTooltip(e, key, done) {
    const d = parseKey(key);
    const formatted = d.toLocaleDateString(LOCALE, {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    tooltip.textContent = done ? `Fait · ${formatted}` : `Rien · ${formatted}`;
    tooltip.classList.remove("hidden");
    moveTooltip(e);
  }
  function moveTooltip(e) {
    const offset = 12;
    let x = e.clientX + offset;
    let y = e.clientY + offset;
    const rect = tooltip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - 8) x = e.clientX - rect.width - offset;
    if (y + rect.height > window.innerHeight - 8) y = e.clientY - rect.height - offset;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }
  function hideTooltip() { tooltip.classList.add("hidden"); }

  // === Modal ===
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

  function updateEmojiSelection() {
    if (!modalState) return;
    emojiGrid.querySelectorAll(".emoji-btn").forEach((b) => {
      b.classList.toggle("selected", b.textContent === modalState.emoji);
    });
  }

  function openModal({ mode, habitId }) {
    if (mode === "create") {
      modalState = { mode, emoji: DEFAULT_EMOJI };
      modalTitle.textContent = "Nouvelle habitude";
      modalNameInput.value = "";
    } else {
      const habit = habits.find((h) => h.id === habitId);
      if (!habit) return;
      modalState = { mode, habitId, emoji: habit.emoji };
      modalTitle.textContent = "Modifier l'habitude";
      modalNameInput.value = habit.name;
    }
    updateEmojiSelection();
    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");
    setTimeout(() => modalNameInput.focus(), 50);
  }

  function closeModal() {
    modal.classList.add("hidden");
    document.body.classList.remove("modal-open");
    modalState = null;
  }

  habitForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!modalState) return;
    const name = modalNameInput.value.trim();
    if (!name) return;
    if (modalState.mode === "create") {
      habits.push({
        id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
        name,
        emoji: modalState.emoji,
        dates: [],
        chartPeriod: "week",
      });
    } else {
      const habit = habits.find((h) => h.id === modalState.habitId);
      if (habit) {
        habit.name = name;
        habit.emoji = modalState.emoji;
      }
    }
    closeModal();
    saveHabits();
    render();
  });

  modalCancel.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
  });

  addBtn.addEventListener("click", () => openModal({ mode: "create" }));

  buildEmojiGrid();
  render();
})();
