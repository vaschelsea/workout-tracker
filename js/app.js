/* ============================================
   Workout Tracker - App Logic
   ============================================ */

(function () {
  'use strict';

  // ─── Data Layer ───────────────────────────────────────

  const STORAGE_KEY = 'workoutTrackerData';

  const defaultData = () => ({
    routines: [],
    workouts: [],
    personalRecords: {},
  });

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return defaultData();
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  let data = loadData();

  function uuid() {
    return crypto.randomUUID ? crypto.randomUUID() :
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
  }

  // ─── DOM Helpers ──────────────────────────────────────

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];

  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'className') e.className = v;
      else if (k === 'textContent') e.textContent = v;
      else if (k === 'innerHTML') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v);
    });
    children.forEach(c => {
      if (typeof c === 'string') e.appendChild(document.createTextNode(c));
      else if (c) e.appendChild(c);
    });
    return e;
  }

  // ─── Navigation ───────────────────────────────────────

  let currentPage = 'home';
  const pages = ['home', 'workouts', 'routines', 'progress'];
  const pageTitles = { home: 'Home', workouts: 'History', routines: 'Routines', progress: 'Progress' };

  function navigateTo(page) {
    if (!pages.includes(page)) return;
    currentPage = page;

    // Update nav buttons
    $$('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === page);
    });

    // Update pages
    $$('.page').forEach(p => {
      p.classList.toggle('active', p.id === `page-${page}`);
    });

    // Update header
    $('#header-title').textContent = pageTitles[page];
    $('#header-right').innerHTML = '';

    if (page === 'routines') {
      const addBtn = el('button', {
        className: 'sheet-action primary',
        textContent: 'Add',
        onClick: () => openRoutineEditor(),
      });
      $('#header-right').appendChild(addBtn);
    }

    // Render page
    renderPage(page);
  }

  function renderPage(page) {
    switch (page) {
      case 'home': renderHome(); break;
      case 'workouts': renderWorkouts(); break;
      case 'routines': renderRoutines(); break;
      case 'progress': renderProgress(); break;
    }
  }

  // ─── Home Page ────────────────────────────────────────

  function renderHome() {
    // Greeting
    const hour = new Date().getHours();
    let greeting = 'Good evening';
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 17) greeting = 'Good afternoon';
    $('#greeting-text').textContent = greeting;

    const totalWorkouts = data.workouts.length;
    const streak = calculateStreak();
    const weekWorkouts = getThisWeekWorkouts();

    $('#stat-week-workouts').textContent = weekWorkouts;
    $('#stat-streak').textContent = streak;
    $('#stat-total').textContent = totalWorkouts;

    if (totalWorkouts === 0) {
      $('#greeting-sub').textContent = 'Ready to start your fitness journey?';
    } else {
      $('#greeting-sub').textContent = streak > 0 ? `${streak} day streak! Keep it up.` : 'Ready to train?';
    }

    // Recent workouts
    const recent = data.workouts.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
    const recentContainer = $('#recent-workouts');
    recentContainer.innerHTML = '';

    if (recent.length === 0) {
      recentContainer.appendChild(emptyState('No workouts yet', 'Tap + to log your first workout'));
    } else {
      recent.forEach(w => recentContainer.appendChild(workoutCard(w)));
    }

    // Quick start routines
    const quickContainer = $('#quick-routines');
    quickContainer.innerHTML = '';

    if (data.routines.length === 0) {
      quickContainer.appendChild(emptyState('No routines', 'Create routines for quick starts'));
    } else {
      data.routines.slice(0, 3).forEach(r => {
        const card = el('button', {
          className: 'starter-routine-btn',
          onClick: () => startFromRoutine(r),
        },
          el('div', { className: 'starter-routine-icon', textContent: r.name.charAt(0).toUpperCase() }),
          el('div', {},
            el('strong', { textContent: r.name }),
            el('span', { textContent: `${r.exercises.length} exercise${r.exercises.length !== 1 ? 's' : ''}` }),
          ),
        );
        quickContainer.appendChild(card);
      });
    }
  }

  function getThisWeekWorkouts() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    return data.workouts.filter(w => new Date(w.date) >= monday).length;
  }

  function calculateStreak() {
    if (data.workouts.length === 0) return 0;

    const workoutDates = new Set(
      data.workouts.map(w => {
        const d = new Date(w.date);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      })
    );

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if there's a workout today
    const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const hasToday = workoutDates.has(todayKey);

    // Start from today or yesterday
    const checkDate = new Date(today);
    if (!hasToday) {
      checkDate.setDate(checkDate.getDate() - 1);
      const yKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
      if (!workoutDates.has(yKey)) return 0;
    }

    while (true) {
      const key = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
      if (workoutDates.has(key)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  // ─── Workouts / History Page ──────────────────────────

  let calendarMonth = new Date().getMonth();
  let calendarYear = new Date().getFullYear();
  let selectedCalendarDate = null;

  function renderWorkouts() {
    renderCalendar();
    renderWorkoutsList();
  }

  function renderCalendar() {
    const container = $('#workouts-calendar-strip');
    container.innerHTML = '';

    const months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Streak indicator
    const streak = calculateStreak();
    if (streak > 0) {
      const streakEl = el('div', { className: 'streak-indicator' },
        el('span', { className: 'streak-fire', textContent: '🔥' }),
        el('span', { textContent: `${streak} day streak` }),
      );
      container.appendChild(streakEl);
    }

    // Month navigation
    const nav = el('div', { className: 'calendar-month-nav' },
      el('button', { textContent: '‹', onClick: () => { calendarMonth--; if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; } renderWorkouts(); } }),
      el('h3', { textContent: `${months[calendarMonth]} ${calendarYear}` }),
      el('button', { textContent: '›', onClick: () => { calendarMonth++; if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; } renderWorkouts(); } }),
    );
    container.appendChild(nav);

    // Calendar grid
    const grid = el('div', { className: 'calendar-grid' });

    // Day labels
    dayLabels.forEach(d => grid.appendChild(el('div', { className: 'calendar-day-label', textContent: d })));

    // Days
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Workout dates set
    const workoutDateSet = new Set();
    data.workouts.forEach(w => {
      const d = new Date(w.date);
      workoutDateSet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    });

    // Previous month fill
    const prevMonthLast = new Date(calendarYear, calendarMonth, 0);
    for (let i = startDay - 1; i >= 0; i--) {
      const day = prevMonthLast.getDate() - i;
      const dayEl = el('div', { className: 'calendar-day other-month', textContent: String(day) });
      grid.appendChild(dayEl);
    }

    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(calendarYear, calendarMonth, d);
      const dateKey = `${calendarYear}-${calendarMonth}-${d}`;
      const isToday = date.getTime() === today.getTime();
      const hasWorkout = workoutDateSet.has(dateKey);
      const isSelected = selectedCalendarDate &&
        selectedCalendarDate.getFullYear() === calendarYear &&
        selectedCalendarDate.getMonth() === calendarMonth &&
        selectedCalendarDate.getDate() === d;

      let classes = 'calendar-day';
      if (isToday) classes += ' today';
      if (hasWorkout) classes += ' has-workout';
      if (isSelected) classes += ' selected';

      const dayEl = el('div', {
        className: classes,
        textContent: String(d),
        onClick: () => {
          selectedCalendarDate = new Date(calendarYear, calendarMonth, d);
          renderWorkouts();
        },
      });
      grid.appendChild(dayEl);
    }

    // Next month fill
    const totalCells = startDay + lastDay.getDate();
    const remaining = (7 - totalCells % 7) % 7;
    for (let d = 1; d <= remaining; d++) {
      grid.appendChild(el('div', { className: 'calendar-day other-month', textContent: String(d) }));
    }

    container.appendChild(grid);
  }

  function renderWorkoutsList() {
    const container = $('#workouts-list');
    container.innerHTML = '';

    let filtered = data.workouts.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

    if (selectedCalendarDate) {
      filtered = filtered.filter(w => {
        const d = new Date(w.date);
        return d.getFullYear() === selectedCalendarDate.getFullYear() &&
          d.getMonth() === selectedCalendarDate.getMonth() &&
          d.getDate() === selectedCalendarDate.getDate();
      });
    }

    if (filtered.length === 0) {
      const msg = selectedCalendarDate ? 'No workouts on this day' : 'No workouts yet';
      container.appendChild(emptyState(msg, 'Tap + to log a workout'));
    } else {
      filtered.forEach(w => container.appendChild(workoutCard(w)));
    }
  }

  // ─── Routines Page ────────────────────────────────────

  function renderRoutines() {
    const container = $('#routines-list');
    container.innerHTML = '';

    if (data.routines.length === 0) {
      container.appendChild(emptyState('No routines yet', 'Create your first routine to get quick starts'));
      return;
    }

    data.routines.forEach(r => {
      const exerciseCount = r.exercises.length;
      const card = el('div', { className: 'routine-card' },
        el('div', {
          className: 'routine-card-info',
          onClick: () => startFromRoutine(r),
        },
          el('div', { className: 'routine-card-name', textContent: r.name }),
          el('div', { className: 'routine-card-meta', textContent: `${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''}` }),
        ),
        el('div', { className: 'routine-card-actions' },
          el('button', {
            className: 'icon-btn accent',
            innerHTML: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
            title: 'Start',
            onClick: (e) => { e.stopPropagation(); startFromRoutine(r); },
          }),
          el('button', {
            className: 'icon-btn',
            innerHTML: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
            title: 'Edit',
            onClick: (e) => { e.stopPropagation(); openRoutineEditor(r); },
          }),
          el('button', {
            className: 'icon-btn danger',
            innerHTML: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m4 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>',
            title: 'Delete',
            onClick: (e) => { e.stopPropagation(); deleteRoutine(r.id); },
          }),
        ),
      );
      container.appendChild(card);
    });
  }

  function deleteRoutine(id) {
    if (!confirm('Delete this routine?')) return;
    data.routines = data.routines.filter(r => r.id !== id);
    saveData();
    renderRoutines();
  }

  // ─── Progress Page ────────────────────────────────────

  let currentProgressPanel = 'records';

  function renderProgress() {
    // Segment control
    $$('#progress-segment .segment-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.segment === currentProgressPanel);
    });
    $$('.progress-panel').forEach(p => {
      p.classList.toggle('active', p.id === `progress-${currentProgressPanel}`);
    });

    switch (currentProgressPanel) {
      case 'records': renderPRs(); break;
      case 'charts': renderCharts(); break;
      case 'volume': renderVolume(); break;
    }
  }

  function renderPRs() {
    const container = $('#pr-list');
    container.innerHTML = '';

    const prs = data.personalRecords;
    const entries = Object.entries(prs);

    if (entries.length === 0) {
      container.appendChild(emptyState('No records yet', 'Complete weight workouts to set personal records'));
      return;
    }

    entries.sort((a, b) => a[0].localeCompare(b[0]));
    entries.forEach(([name, info]) => {
      const card = el('div', { className: 'pr-card' },
        el('div', { className: 'pr-trophy', textContent: '🏆' }),
        el('div', { className: 'pr-info' },
          el('div', { className: 'pr-name', textContent: name }),
          el('div', { className: 'pr-detail', textContent: formatDate(info.date) }),
        ),
        el('div', { className: 'pr-value', textContent: `${info.weight}kg` }),
      );
      container.appendChild(card);
    });
  }

  function renderCharts() {
    const select = $('#chart-exercise-select');
    const exercises = getAllWeightExerciseNames();

    // Populate dropdown
    const currentVal = select.value;
    select.innerHTML = '<option value="">Select exercise</option>';
    exercises.forEach(name => {
      const opt = el('option', { value: name, textContent: name });
      if (name === currentVal) opt.selected = true;
      select.appendChild(opt);
    });

    if (currentVal) {
      drawProgressChart(currentVal);
    }
  }

  function drawProgressChart(exerciseName) {
    const canvas = $('#progress-chart');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 200 * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = 200;
    ctx.clearRect(0, 0, w, h);

    // Gather data points: date -> max weight
    const points = [];
    data.workouts
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach(workout => {
        workout.exercises.forEach(ex => {
          if (ex.name === exerciseName && ex.type === 'weights' && ex.sets) {
            const maxW = Math.max(...ex.sets.map(s => s.weight || 0));
            if (maxW > 0) {
              points.push({ date: new Date(workout.date), weight: maxW });
            }
          }
        });
      });

    if (points.length < 2) {
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-text-tertiary').trim();
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Need at least 2 data points', w / 2, h / 2);
      return;
    }

    const weights = points.map(p => p.weight);
    const minW = Math.min(...weights) * 0.9;
    const maxW = Math.max(...weights) * 1.1;
    const range = maxW - minW || 1;

    const padL = 45, padR = 15, padT = 20, padB = 30;
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const lineColor = isDark ? '#0A84FF' : '#007AFF';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? '#98989D' : '#8E8E93';

    // Y-axis grid
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    ctx.fillStyle = textColor;
    ctx.font = '11px system-ui';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = padT + chartH - (chartH * i / 4);
      const val = minW + range * i / 4;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.fillText(Math.round(val) + 'kg', padL - 6, y + 4);
    }

    // Plot line
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = padL + (chartW * i / (points.length - 1));
      const y = padT + chartH - (chartH * (p.weight - minW) / range);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Gradient fill
    const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
    grad.addColorStop(0, isDark ? 'rgba(10,132,255,0.3)' : 'rgba(0,122,255,0.15)');
    grad.addColorStop(1, isDark ? 'rgba(10,132,255,0)' : 'rgba(0,122,255,0)');
    ctx.fillStyle = grad;
    ctx.lineTo(padL + chartW, padT + chartH);
    ctx.lineTo(padL, padT + chartH);
    ctx.closePath();
    ctx.fill();

    // Dots
    points.forEach((p, i) => {
      const x = padL + (chartW * i / (points.length - 1));
      const y = padT + chartH - (chartH * (p.weight - minW) / range);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();
      ctx.strokeStyle = isDark ? '#1C1C1E' : '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // X-axis labels
    ctx.fillStyle = textColor;
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    const labelStep = Math.max(1, Math.floor(points.length / 5));
    points.forEach((p, i) => {
      if (i % labelStep === 0 || i === points.length - 1) {
        const x = padL + (chartW * i / (points.length - 1));
        const label = `${p.date.getMonth() + 1}/${p.date.getDate()}`;
        ctx.fillText(label, x, h - 6);
      }
    });
  }

  let volumePeriod = 'week';

  function renderVolume() {
    const canvas = $('#volume-chart');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 200 * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = 200;
    ctx.clearRect(0, 0, w, h);

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const barColor = isDark ? '#30D158' : '#34C759';
    const textColor = isDark ? '#98989D' : '#8E8E93';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

    // Group workouts by period
    const buckets = {};

    data.workouts.forEach(workout => {
      const d = new Date(workout.date);
      let key;
      if (volumePeriod === 'week') {
        // ISO week
        const jan1 = new Date(d.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
        key = `W${weekNum}`;
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }

      let volume = 0;
      workout.exercises.forEach(ex => {
        if (ex.type === 'weights' && ex.sets) {
          ex.sets.forEach(s => {
            volume += (s.reps || 0) * (s.weight || 0);
          });
        }
      });

      buckets[key] = (buckets[key] || 0) + volume;
    });

    const entries = Object.entries(buckets).sort((a, b) => a[0].localeCompare(b[0])).slice(-8);

    if (entries.length === 0) {
      ctx.fillStyle = textColor;
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('No volume data yet', w / 2, h / 2);
      return;
    }

    const maxVol = Math.max(...entries.map(e => e[1])) || 1;
    const padL = 50, padR = 15, padT = 15, padB = 30;
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;
    const barWidth = Math.min(36, (chartW / entries.length) * 0.6);
    const gap = chartW / entries.length;

    // Grid
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    ctx.fillStyle = textColor;
    ctx.font = '10px system-ui';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = padT + chartH - (chartH * i / 4);
      const val = maxVol * i / 4;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      let label;
      if (val >= 1000) label = (val / 1000).toFixed(1) + 'k';
      else label = Math.round(val).toString();
      ctx.fillText(label, padL - 6, y + 4);
    }

    // Bars
    entries.forEach(([label, vol], i) => {
      const x = padL + gap * i + gap / 2 - barWidth / 2;
      const barH = (vol / maxVol) * chartH;
      const y = padT + chartH - barH;

      ctx.fillStyle = barColor;
      roundRect(ctx, x, y, barWidth, barH, 4);
      ctx.fill();

      // Label
      ctx.fillStyle = textColor;
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(label, padL + gap * i + gap / 2, h - 6);
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function getAllWeightExerciseNames() {
    const names = new Set();
    data.workouts.forEach(w => {
      w.exercises.forEach(ex => {
        if (ex.type === 'weights') names.add(ex.name);
      });
    });
    return [...names].sort();
  }

  function getAllExerciseNames() {
    const names = new Set();
    data.workouts.forEach(w => {
      w.exercises.forEach(ex => names.add(ex.name));
    });
    data.routines.forEach(r => {
      r.exercises.forEach(ex => names.add(ex.name));
    });
    return [...names].sort();
  }

  // ─── Shared UI Components ────────────────────────────

  function emptyState(title, subtitle) {
    return el('div', { className: 'empty-state' },
      el('div', { className: 'empty-state-icon', textContent: '📋' }),
      el('h3', { textContent: title }),
      el('p', { textContent: subtitle }),
    );
  }

  function workoutCard(workout) {
    const d = new Date(workout.date);
    const card = el('div', {
      className: 'workout-card',
      onClick: () => openWorkoutDetail(workout),
    },
      el('div', { className: 'workout-card-header' },
        el('span', { className: 'workout-card-title', textContent: workout.routineName || 'Workout' }),
        el('span', { className: 'workout-card-date', textContent: formatDate(d) }),
      ),
      el('div', { className: 'workout-card-exercises' },
        ...workout.exercises.map(ex =>
          el('span', {
            className: `exercise-tag ${ex.type}`,
            textContent: ex.type === 'weights'
              ? `${ex.name} · ${ex.sets ? ex.sets.length : 0}s`
              : `${ex.name} · ${ex.duration || 0}min`,
          })
        ),
      ),
    );
    return card;
  }

  function formatDate(d) {
    const date = d instanceof Date ? d : new Date(d);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    const diff = Math.floor((today - target) / 86400000);

    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }

  // ─── Workout Starter Modal ───────────────────────────

  function openWorkoutStarter() {
    const routinesList = $('#starter-routines');
    routinesList.innerHTML = '';

    if (data.routines.length === 0) {
      routinesList.appendChild(
        el('p', {
          className: 'empty-state',
          innerHTML: '<span style="font-size:13px;color:var(--color-text-tertiary)">No routines created yet</span>',
        })
      );
    } else {
      data.routines.forEach(r => {
        const btn = el('button', {
          className: 'starter-routine-btn',
          onClick: () => { closeModal('modal-starter'); startFromRoutine(r); },
        },
          el('div', { className: 'starter-routine-icon', textContent: r.name.charAt(0).toUpperCase() }),
          el('div', {},
            el('strong', { textContent: r.name }),
            el('span', { textContent: `${r.exercises.length} exercise${r.exercises.length !== 1 ? 's' : ''}` }),
          ),
        );
        routinesList.appendChild(btn);
      });
    }

    openModal('modal-starter');
  }

  function startFromRoutine(routine) {
    closeModal('modal-starter');
    openWorkoutEditor(null, routine);
  }

  // ─── Workout Editor Modal ────────────────────────────

  let editingWorkout = null;
  let workoutExercises = [];

  function openWorkoutEditor(existingWorkout, routine) {
    editingWorkout = existingWorkout;
    workoutExercises = [];

    if (existingWorkout) {
      $('#workout-sheet-title').textContent = 'Edit Workout';
      $('#workout-name').value = existingWorkout.routineName || '';
      workoutExercises = JSON.parse(JSON.stringify(existingWorkout.exercises));
    } else if (routine) {
      $('#workout-sheet-title').textContent = 'New Workout';
      $('#workout-name').value = routine.name;
      workoutExercises = routine.exercises.map(ex => {
        if (ex.type === 'weights') {
          const sets = [];
          for (let i = 0; i < (ex.defaultSets || 3); i++) {
            sets.push({ reps: ex.defaultReps || 10, weight: ex.defaultWeight || 0 });
          }
          return { name: ex.name, type: 'weights', sets };
        } else {
          return { name: ex.name, type: 'cardio', duration: ex.defaultDuration || 0, distance: ex.defaultDistance || 0 };
        }
      });
    } else {
      $('#workout-sheet-title').textContent = 'New Workout';
      $('#workout-name').value = '';
      workoutExercises = [];
    }

    renderWorkoutExercises();
    openModal('modal-workout');
  }

  function renderWorkoutExercises() {
    const container = $('#workout-exercises');
    container.innerHTML = '';

    workoutExercises.forEach((ex, idx) => {
      container.appendChild(createExerciseEditor(ex, idx, 'workout'));
    });
  }

  function createExerciseEditor(exercise, index, context) {
    const wrapper = el('div', { className: 'exercise-editor' });

    // Header row
    const header = el('div', { className: 'exercise-editor-header' });

    const nameWrapper = el('div', { className: 'exercise-name-input' });
    const nameInput = el('input', {
      type: 'text',
      placeholder: 'Exercise name',
      value: exercise.name || '',
    });
    nameInput.addEventListener('input', (e) => {
      exercise.name = e.target.value;
      showAutocomplete(e.target, e.target.value);
    });
    nameInput.addEventListener('blur', () => {
      setTimeout(() => hideAutocomplete(), 200);
    });
    nameWrapper.appendChild(nameInput);
    header.appendChild(nameWrapper);

    // Type toggle
    const typeToggle = el('div', { className: 'exercise-type-toggle' });
    const weightsBtn = el('button', {
      className: `type-btn ${exercise.type === 'weights' ? 'active' : ''}`,
      textContent: 'Weights',
      onClick: () => {
        exercise.type = 'weights';
        if (!exercise.sets) exercise.sets = [{ reps: 10, weight: 0 }];
        rerender();
      },
    });
    const cardioBtn = el('button', {
      className: `type-btn ${exercise.type === 'cardio' ? 'active' : ''}`,
      textContent: 'Cardio',
      onClick: () => {
        exercise.type = 'cardio';
        if (!exercise.duration) exercise.duration = 0;
        if (!exercise.distance) exercise.distance = 0;
        rerender();
      },
    });
    typeToggle.appendChild(weightsBtn);
    typeToggle.appendChild(cardioBtn);
    header.appendChild(typeToggle);

    // Controls (move up/down, remove)
    const controls = el('div', { className: 'exercise-controls' });
    const exercises = context === 'workout' ? workoutExercises : routineExercisesEdit;

    if (index > 0) {
      controls.appendChild(el('button', {
        textContent: '↑',
        onClick: () => { [exercises[index - 1], exercises[index]] = [exercises[index], exercises[index - 1]]; rerender(); },
      }));
    }
    if (index < exercises.length - 1) {
      controls.appendChild(el('button', {
        textContent: '↓',
        onClick: () => { [exercises[index], exercises[index + 1]] = [exercises[index + 1], exercises[index]]; rerender(); },
      }));
    }
    controls.appendChild(el('button', {
      className: 'remove-exercise',
      textContent: '×',
      onClick: () => { exercises.splice(index, 1); rerender(); },
    }));
    header.appendChild(controls);

    wrapper.appendChild(header);

    function rerender() {
      if (context === 'workout') renderWorkoutExercises();
      else renderRoutineExercises();
    }

    // Body: sets or cardio
    if (exercise.type === 'weights') {
      if (!exercise.sets) exercise.sets = [{ reps: 10, weight: 0 }];

      const setsHeader = el('div', { className: 'sets-header' },
        el('span', { textContent: 'Set' }),
        el('span', { textContent: 'Reps' }),
        el('span', { textContent: 'Weight (kg)' }),
        el('span'),
      );
      wrapper.appendChild(setsHeader);

      exercise.sets.forEach((set, si) => {
        const row = el('div', { className: 'set-row' },
          el('div', { className: 'set-number', textContent: String(si + 1) }),
        );

        const repsInput = el('input', {
          type: 'number',
          value: String(set.reps || ''),
          placeholder: '0',
          inputmode: 'numeric',
        });
        repsInput.addEventListener('input', (e) => { set.reps = parseInt(e.target.value) || 0; });
        row.appendChild(repsInput);

        const weightInput = el('input', {
          type: 'number',
          value: String(set.weight || ''),
          placeholder: '0',
          inputmode: 'decimal',
        });
        weightInput.addEventListener('input', (e) => { set.weight = parseFloat(e.target.value) || 0; });
        row.appendChild(weightInput);

        const removeBtn = el('button', {
          className: 'remove-set-btn',
          textContent: '−',
          onClick: () => { exercise.sets.splice(si, 1); rerender(); },
        });
        row.appendChild(removeBtn);

        wrapper.appendChild(row);
      });

      const addSetBtn = el('button', {
        className: 'add-set-btn',
        textContent: '+ Add Set',
        onClick: () => {
          const lastSet = exercise.sets[exercise.sets.length - 1] || { reps: 10, weight: 0 };
          exercise.sets.push({ reps: lastSet.reps, weight: lastSet.weight });
          rerender();
        },
      });
      wrapper.appendChild(addSetBtn);
    } else {
      // Cardio
      const fields = el('div', { className: 'cardio-fields' });

      const durField = el('div', { className: 'cardio-field' });
      durField.appendChild(el('label', { textContent: 'Duration (min)' }));
      const durInput = el('input', {
        type: 'number',
        value: String(exercise.duration || ''),
        placeholder: '0',
        inputmode: 'numeric',
      });
      durInput.addEventListener('input', (e) => { exercise.duration = parseInt(e.target.value) || 0; });
      durField.appendChild(durInput);
      fields.appendChild(durField);

      const distField = el('div', { className: 'cardio-field' });
      distField.appendChild(el('label', { textContent: 'Distance (km)' }));
      const distInput = el('input', {
        type: 'number',
        value: String(exercise.distance || ''),
        placeholder: '0',
        inputmode: 'decimal',
      });
      distInput.addEventListener('input', (e) => { exercise.distance = parseFloat(e.target.value) || 0; });
      distField.appendChild(distInput);
      fields.appendChild(distField);

      wrapper.appendChild(fields);
    }

    return wrapper;
  }

  function saveWorkout() {
    const name = $('#workout-name').value.trim();
    if (workoutExercises.length === 0) {
      alert('Add at least one exercise');
      return;
    }

    // Validate exercises have names
    for (const ex of workoutExercises) {
      if (!ex.name.trim()) {
        alert('All exercises need a name');
        return;
      }
    }

    const workout = {
      id: editingWorkout ? editingWorkout.id : uuid(),
      date: editingWorkout ? editingWorkout.date : new Date().toISOString(),
      routineName: name || 'Workout',
      exercises: JSON.parse(JSON.stringify(workoutExercises)),
    };

    if (editingWorkout) {
      const idx = data.workouts.findIndex(w => w.id === editingWorkout.id);
      if (idx >= 0) data.workouts[idx] = workout;
    } else {
      data.workouts.push(workout);
    }

    // Check for PRs
    const newPRs = checkAndUpdatePRs(workout);
    saveData();

    closeModal('modal-workout');
    renderPage(currentPage);

    if (newPRs.length > 0) {
      showPRCelebration(newPRs);
    }
  }

  function checkAndUpdatePRs(workout) {
    const newPRs = [];
    workout.exercises.forEach(ex => {
      if (ex.type === 'weights' && ex.sets) {
        const maxWeight = Math.max(...ex.sets.map(s => s.weight || 0));
        if (maxWeight > 0) {
          const current = data.personalRecords[ex.name];
          if (!current || maxWeight > current.weight) {
            data.personalRecords[ex.name] = {
              weight: maxWeight,
              date: workout.date,
            };
            newPRs.push({ name: ex.name, weight: maxWeight });
          }
        }
      }
    });
    return newPRs;
  }

  function showPRCelebration(prs) {
    const celebration = $('#pr-celebration');
    const text = prs.map(pr => `${pr.name}: ${pr.weight}kg`).join('\n');
    $('#pr-celebration-text').textContent = text;
    celebration.classList.remove('hidden');
  }

  // ─── Routine Editor ───────────────────────────────────

  let editingRoutine = null;
  let routineExercisesEdit = [];

  function openRoutineEditor(existing) {
    editingRoutine = existing || null;
    routineExercisesEdit = [];

    if (existing) {
      $('#routine-sheet-title').textContent = 'Edit Routine';
      $('#routine-name').value = existing.name;
      routineExercisesEdit = existing.exercises.map(ex => {
        if (ex.type === 'weights') {
          return {
            name: ex.name, type: 'weights',
            sets: [{ reps: ex.defaultReps || 10, weight: ex.defaultWeight || 0 }],
            defaultSets: ex.defaultSets || 3,
            defaultReps: ex.defaultReps || 10,
            defaultWeight: ex.defaultWeight || 0,
          };
        } else {
          return {
            name: ex.name, type: 'cardio',
            duration: ex.defaultDuration || 0,
            distance: ex.defaultDistance || 0,
            defaultDuration: ex.defaultDuration || 0,
            defaultDistance: ex.defaultDistance || 0,
          };
        }
      });
    } else {
      $('#routine-sheet-title').textContent = 'New Routine';
      $('#routine-name').value = '';
    }

    renderRoutineExercises();
    openModal('modal-routine');
  }

  function renderRoutineExercises() {
    const container = $('#routine-exercises');
    container.innerHTML = '';
    routineExercisesEdit.forEach((ex, idx) => {
      container.appendChild(createExerciseEditor(ex, idx, 'routine'));
    });
  }

  function saveRoutine() {
    const name = $('#routine-name').value.trim();
    if (!name) {
      alert('Give your routine a name');
      return;
    }
    if (routineExercisesEdit.length === 0) {
      alert('Add at least one exercise');
      return;
    }

    const exercises = routineExercisesEdit.map(ex => {
      if (ex.type === 'weights') {
        const sets = ex.sets || [{ reps: 10, weight: 0 }];
        return {
          name: ex.name,
          type: 'weights',
          defaultSets: sets.length || ex.defaultSets || 3,
          defaultReps: sets[0] ? sets[0].reps : (ex.defaultReps || 10),
          defaultWeight: sets[0] ? sets[0].weight : (ex.defaultWeight || 0),
        };
      } else {
        return {
          name: ex.name,
          type: 'cardio',
          defaultDuration: ex.duration || ex.defaultDuration || 0,
          defaultDistance: ex.distance || ex.defaultDistance || 0,
        };
      }
    });

    if (editingRoutine) {
      const idx = data.routines.findIndex(r => r.id === editingRoutine.id);
      if (idx >= 0) {
        data.routines[idx].name = name;
        data.routines[idx].exercises = exercises;
      }
    } else {
      data.routines.push({ id: uuid(), name, exercises });
    }

    saveData();
    closeModal('modal-routine');
    renderPage(currentPage);
  }

  // ─── Workout Detail ───────────────────────────────────

  function openWorkoutDetail(workout) {
    const body = $('#detail-body');
    body.innerHTML = '';

    $('#detail-title').textContent = workout.routineName || 'Workout';

    const d = new Date(workout.date);
    const fullDate = d.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    body.appendChild(el('div', { className: 'detail-date', textContent: `${fullDate} at ${time}` }));

    workout.exercises.forEach(ex => {
      const exEl = el('div', { className: 'detail-exercise' });
      exEl.appendChild(
        el('div', { className: 'detail-exercise-name' },
          document.createTextNode(ex.name),
          el('span', { className: `detail-exercise-type ${ex.type}`, textContent: ex.type }),
        )
      );

      if (ex.type === 'weights' && ex.sets) {
        const setsList = el('div', { className: 'detail-sets-list' });
        ex.sets.forEach((s, i) => {
          setsList.appendChild(
            el('div', { className: 'detail-set' },
              el('span', { className: 'set-num', textContent: String(i + 1) }),
              el('span', { textContent: `${s.reps} reps × ${s.weight}kg` }),
            )
          );
        });
        exEl.appendChild(setsList);
      } else if (ex.type === 'cardio') {
        exEl.appendChild(
          el('div', { className: 'detail-cardio', textContent: `${ex.duration || 0} min · ${ex.distance || 0} km` })
        );
      }

      body.appendChild(exEl);
    });

    // Repeat button
    const repeatBtn = el('button', {
      className: 'btn-primary detail-repeat-btn',
      textContent: 'Repeat This Workout',
      onClick: () => {
        closeModal('modal-detail');
        openWorkoutEditor(null, {
          name: workout.routineName,
          exercises: workout.exercises.map(ex => {
            if (ex.type === 'weights') {
              return {
                name: ex.name, type: 'weights',
                defaultSets: ex.sets ? ex.sets.length : 3,
                defaultReps: ex.sets && ex.sets[0] ? ex.sets[0].reps : 10,
                defaultWeight: ex.sets && ex.sets[0] ? ex.sets[0].weight : 0,
              };
            } else {
              return {
                name: ex.name, type: 'cardio',
                defaultDuration: ex.duration || 0,
                defaultDistance: ex.distance || 0,
              };
            }
          }),
        });
      },
    });
    body.appendChild(repeatBtn);

    // Store ref for delete
    $('#detail-delete').onclick = () => {
      if (confirm('Delete this workout?')) {
        data.workouts = data.workouts.filter(w => w.id !== workout.id);
        recalculatePRs();
        saveData();
        closeModal('modal-detail');
        renderPage(currentPage);
      }
    };

    openModal('modal-detail');
  }

  function recalculatePRs() {
    data.personalRecords = {};
    data.workouts.forEach(w => {
      w.exercises.forEach(ex => {
        if (ex.type === 'weights' && ex.sets) {
          const maxW = Math.max(...ex.sets.map(s => s.weight || 0));
          if (maxW > 0) {
            const current = data.personalRecords[ex.name];
            if (!current || maxW > current.weight) {
              data.personalRecords[ex.name] = { weight: maxW, date: w.date };
            }
          }
        }
      });
    });
  }

  // ─── Autocomplete ─────────────────────────────────────

  let activeAutocompleteInput = null;

  function showAutocomplete(input, query) {
    const dropdown = $('#autocomplete-dropdown');
    if (!query || query.length < 1) {
      hideAutocomplete();
      return;
    }

    const names = getAllExerciseNames().filter(n =>
      n.toLowerCase().includes(query.toLowerCase()) && n.toLowerCase() !== query.toLowerCase()
    );

    if (names.length === 0) {
      hideAutocomplete();
      return;
    }

    dropdown.innerHTML = '';
    names.slice(0, 5).forEach(name => {
      const item = el('div', {
        className: 'autocomplete-item',
        textContent: name,
        onMousedown: (e) => {
          e.preventDefault();
          input.value = name;
          input.dispatchEvent(new Event('input'));
          // Update the exercise object
          const editorEl = input.closest('.exercise-editor');
          if (editorEl) {
            const idx = [...editorEl.parentElement.children].indexOf(editorEl);
            const exercises = editorEl.closest('#workout-exercises') ? workoutExercises : routineExercisesEdit;
            if (exercises[idx]) exercises[idx].name = name;
          }
          hideAutocomplete();
        },
      });
      dropdown.appendChild(item);
    });

    // Position
    const rect = input.getBoundingClientRect();
    dropdown.style.top = (rect.bottom + 4) + 'px';
    dropdown.style.left = rect.left + 'px';
    dropdown.style.width = rect.width + 'px';
    dropdown.classList.remove('hidden');
    activeAutocompleteInput = input;
  }

  function hideAutocomplete() {
    const dropdown = $('#autocomplete-dropdown');
    dropdown.classList.add('hidden');
    activeAutocompleteInput = null;
  }

  // ─── Modal Helpers ────────────────────────────────────

  function openModal(id) {
    const modal = $(`#${id}`);
    // Delay to allow transition
    requestAnimationFrame(() => {
      modal.classList.add('open');
    });
  }

  function closeModal(id) {
    const modal = $(`#${id}`);
    modal.classList.remove('open');
  }

  // ─── Event Bindings ───────────────────────────────────

  function init() {
    // Navigation
    $$('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.page));
    });

    // FAB
    $('#fab').addEventListener('click', openWorkoutStarter);

    // Freestyle start
    $('#start-freestyle').addEventListener('click', () => {
      closeModal('modal-starter');
      openWorkoutEditor(null, null);
    });

    // Starter cancel
    $('#starter-cancel').addEventListener('click', () => closeModal('modal-starter'));

    // Workout modal
    $('#workout-cancel').addEventListener('click', () => closeModal('modal-workout'));
    $('#workout-save').addEventListener('click', saveWorkout);
    $('#add-exercise-btn').addEventListener('click', () => {
      workoutExercises.push({ name: '', type: 'weights', sets: [{ reps: 10, weight: 0 }] });
      renderWorkoutExercises();
      // Scroll to bottom
      const body = $('#modal-workout .sheet-body');
      setTimeout(() => body.scrollTop = body.scrollHeight, 50);
    });

    // Routine modal
    $('#routine-cancel').addEventListener('click', () => closeModal('modal-routine'));
    $('#routine-save').addEventListener('click', saveRoutine);
    $('#routine-add-exercise-btn').addEventListener('click', () => {
      routineExercisesEdit.push({ name: '', type: 'weights', sets: [{ reps: 10, weight: 0 }] });
      renderRoutineExercises();
      const body = $('#modal-routine .sheet-body');
      setTimeout(() => body.scrollTop = body.scrollHeight, 50);
    });

    // Detail modal
    $('#detail-close').addEventListener('click', () => closeModal('modal-detail'));

    // PR celebration dismiss
    $('#pr-dismiss').addEventListener('click', () => {
      $('#pr-celebration').classList.add('hidden');
    });

    // Modal backdrops close
    $$('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', () => {
        const modal = backdrop.closest('.modal');
        modal.classList.remove('open');
      });
    });

    // Progress segment control
    $$('#progress-segment .segment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentProgressPanel = btn.dataset.segment;
        renderProgress();
      });
    });

    // Chart exercise select
    $('#chart-exercise-select').addEventListener('change', (e) => {
      if (e.target.value) drawProgressChart(e.target.value);
    });

    // Volume period toggle
    $$('#progress-volume .sub-segment .segment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        volumePeriod = btn.dataset.period;
        $$('#progress-volume .sub-segment .segment-btn').forEach(b =>
          b.classList.toggle('active', b === btn)
        );
        renderVolume();
      });
    });

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    // Initial render
    navigateTo('home');
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
