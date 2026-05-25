(function () {
  "use strict";

  const STORAGE_KEY = "habitracker.habits.v1";
  const WEEKS = 53;
  const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const form = document.getElementById("addHabitForm");
  const nameInput = document.getElementById("habitName");
  const list = document.getElementById("habitsList");
  const emptyState = document.getElementById("emptyState");
  const template = document.getElementById("habitTemplate");
  const tooltip = document.getElementById("tooltip");
  const globalStreakEl = document.getElementById("globalStreak");

  let habits = loadHabits();

  function loadHabits() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((h) => ({
        id: String(h.id),
        name: String(h.name || "Untitled habit"),
        dates: Array.isArray(h.dates) ? h.dates.filter((d) => typeof d === "string") : [],
      }));
    } catch (e) {
      return [];
    }
  }

  function saveHabits() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
  }

  function todayKey() {
    return dateKey(new Date());
  }

  function dateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseKey(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function startOfWeek(date) {
    // Week starts Sunday (GitHub style)
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }

  function computeStreak(dates) {
    const set = new Set(dates);
    let streak = 0;
    let d = new Date();
    d.setHours(0, 0, 0, 0);
    // If today isn't done, start from yesterday
    if (!set.has(dateKey(d))) {
      d = addDays(d, -1);
    }
    while (set.has(dateKey(d))) {
      streak++;
      d = addDays(d, -1);
    }
    return streak;
  }

  function globalStreak() {
    if (!habits.length) return 0;
    return Math.max(...habits.map((h) => computeStreak(h.dates)));
  }

  function render() {
    list.innerHTML = "";

    if (!habits.length) {
      emptyState.classList.remove("hidden");
    } else {
      emptyState.classList.add("hidden");
      habits.forEach(renderHabit);
    }

    const s = globalStreak();
    globalStreakEl.textContent = `${s} day streak`;
  }

  function renderHabit(habit) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.id = habit.id;

    node.querySelector(".habit-name").textContent = habit.name;
    node.querySelector(".streak-count").textContent = computeStreak(habit.dates);
    node.querySelector(".total-count").textContent = habit.dates.length;

    const todayBtn = node.querySelector(".today-btn");
    const isDoneToday = habit.dates.includes(todayKey());
    if (isDoneToday) {
      todayBtn.classList.add("done");
      todayBtn.textContent = "Done today";
    } else {
      todayBtn.textContent = "Mark today";
    }
    todayBtn.addEventListener("click", () => toggleDay(habit.id, todayKey()));

    node.querySelector(".delete-btn").addEventListener("click", () => {
      if (confirm(`Delete "${habit.name}"? This cannot be undone.`)) {
        deleteHabit(habit.id);
      }
    });

    buildGrid(node, habit);

    list.appendChild(node);
  }

  function buildGrid(node, habit) {
    const grid = node.querySelector(".grid");
    const monthLabels = node.querySelector(".month-labels");
    grid.innerHTML = "";
    monthLabels.innerHTML = "";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endWeekStart = startOfWeek(today);
    const startWeek = addDays(endWeekStart, -(WEEKS - 1) * 7);
    const doneSet = new Set(habit.dates);

    const monthsSeen = new Set();

    for (let w = 0; w < WEEKS; w++) {
      const weekStart = addDays(startWeek, w * 7);

      // Place month label when month changes (first cell of the week)
      const monthKey = `${weekStart.getFullYear()}-${weekStart.getMonth()}`;
      if (!monthsSeen.has(monthKey) && weekStart.getDate() <= 7) {
        monthsSeen.add(monthKey);
        const span = document.createElement("span");
        span.textContent = MONTH_NAMES[weekStart.getMonth()];
        span.style.gridColumn = w + 1;
        monthLabels.appendChild(span);
      }

      for (let day = 0; day < 7; day++) {
        const cell = document.createElement("div");
        cell.className = "day-cell";
        const cellDate = addDays(weekStart, day);
        cellDate.setHours(0, 0, 0, 0);

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

    // Don't allow future dates
    if (parseKey(key) > new Date()) return;

    const idx = habit.dates.indexOf(key);
    if (idx >= 0) {
      habit.dates.splice(idx, 1);
    } else {
      habit.dates.push(key);
    }
    saveHabits();
    render();
  }

  function deleteHabit(id) {
    habits = habits.filter((h) => h.id !== id);
    saveHabits();
    render();
  }

  function showTooltip(e, key, done) {
    const d = parseKey(key);
    const formatted = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    tooltip.textContent = done ? `Done · ${formatted}` : `No activity · ${formatted}`;
    tooltip.classList.remove("hidden");
    moveTooltip(e);
  }

  function moveTooltip(e) {
    const offset = 12;
    let x = e.clientX + offset;
    let y = e.clientY + offset;
    const rect = tooltip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - 8) {
      x = e.clientX - rect.width - offset;
    }
    if (y + rect.height > window.innerHeight - 8) {
      y = e.clientY - rect.height - offset;
    }
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }

  function hideTooltip() {
    tooltip.classList.add("hidden");
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return;
    habits.push({
      id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
      name,
      dates: [],
    });
    nameInput.value = "";
    saveHabits();
    render();
  });

  render();
})();
