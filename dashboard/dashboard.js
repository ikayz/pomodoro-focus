/**
 * Full Dashboard Script for Pomodoro Focus Pro
 * In-depth analytics, HTML5 Canvas charts, complete session logs, task planner, export/import, and settings.
 */

let settingsState = null;
let timerState = null;
let tasksState = [];
let historyState = [];

let currentTrendDays = 7;
let currentDashTaskFilter = 'all';

// DOM Elements - Navigation
const navItems = document.querySelectorAll('.nav-item');
const contentPanes = document.querySelectorAll('.content-pane');

// DOM Elements - Analytics
const kpiTotalPomos = document.getElementById('kpiTotalPomos');
const kpiTotalTime = document.getElementById('kpiTotalTime');
const kpiStreak = document.getElementById('kpiStreak');
const kpiTodayPomos = document.getElementById('kpiTodayPomos');
const trendChartCanvas = document.getElementById('trendChartCanvas');
const taskDistributionCanvas = document.getElementById('taskDistributionCanvas');
const historyTableBody = document.getElementById('historyTableBody');
const historyFilterMode = document.getElementById('historyFilterMode');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const importJsonInput = document.getElementById('importJsonInput');
const chartTimeframePills = document.querySelectorAll('.chart-timeframe-pills .pill-btn');

// DOM Elements - Tasks Planner
const dashAddTaskForm = document.getElementById('dashAddTaskForm');
const dashTaskTitle = document.getElementById('dashTaskTitle');
const dashTaskEst = document.getElementById('dashTaskEst');
const dashTaskList = document.getElementById('dashTaskList');
const dashFilterBtns = document.querySelectorAll('[data-dash-filter]');
const tasksSummaryText = document.getElementById('tasksSummaryText');

// DOM Elements - Settings
const settingsForm = document.getElementById('settingsForm');
const setPomodoroTime = document.getElementById('setPomodoroTime');
const setShortBreakTime = document.getElementById('setShortBreakTime');
const setLongBreakTime = document.getElementById('setLongBreakTime');
const setLongBreakInterval = document.getElementById('setLongBreakInterval');
const setAutoStartBreaks = document.getElementById('setAutoStartBreaks');
const setAutoStartPomodoros = document.getElementById('setAutoStartPomodoros');
const setDailyGoal = document.getElementById('setDailyGoal');
const setSoundNotification = document.getElementById('setSoundNotification');
const setSoundType = document.getElementById('setSoundType');
const setSoundVolume = document.getElementById('setSoundVolume');
const soundVolVal = document.getElementById('soundVolVal');
const testSoundBtn = document.getElementById('testSoundBtn');
const setAmbientSound = document.getElementById('setAmbientSound');
const setAmbientVolume = document.getElementById('setAmbientVolume');
const ambientVolVal = document.getElementById('ambientVolVal');
const setDesktopNotification = document.getElementById('setDesktopNotification');
const setShowBadgeTime = document.getElementById('setShowBadgeTime');
const setTheme = document.getElementById('setTheme');
const saveStatusToast = document.getElementById('saveStatusToast');

// ----------------- Initialization -----------------
async function init() {
  await loadState();
  setupNavigation();
  setupEventListeners();
  checkHashRoute();
  renderAll();
}

async function loadState() {
  settingsState = await ExtensionStorage.getSettings();
  timerState = await ExtensionStorage.getTimer();
  tasksState = await ExtensionStorage.getTasks();
  historyState = await ExtensionStorage.getHistory();

  applyTheme(settingsState.theme);
}

function applyTheme(theme) {
  if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
  } else {
    document.body.setAttribute('data-theme', theme || 'dark');
  }
}

function checkHashRoute() {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'settings') {
    switchTab('settings');
  } else if (hash === 'tasks') {
    switchTab('tasks');
  } else {
    switchTab('analytics');
  }
}

function switchTab(tabId) {
  navItems.forEach(item => item.classList.toggle('active', item.dataset.tab === tabId));
  contentPanes.forEach(pane => pane.classList.toggle('active', pane.id === `pane-${tabId}`));
  window.location.hash = tabId;

  if (tabId === 'analytics') {
    renderAnalytics();
  }
}

function renderAll() {
  renderAnalytics();
  renderTaskPlanner();
  populateSettingsForm();
}

// ----------------- TAB 1: Analytics & History -----------------
function renderAnalytics() {
  // 1. KPI Cards
  const pomoHistory = historyState.filter(h => h.mode === 'pomodoro');
  const totalPomos = pomoHistory.length;
  const totalMins = pomoHistory.reduce((acc, h) => acc + (h.durationMinutes || 25), 0);

  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;

  kpiTotalPomos.textContent = totalPomos;
  kpiTotalTime.textContent = `${hours}h ${mins}m`;
  kpiStreak.textContent = `${calculateStreak(historyState)} Days`;

  // Today's pomos
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayPomos = pomoHistory.filter(h => h.timestamp >= todayStart).length;
  kpiTodayPomos.textContent = `${todayPomos} / ${settingsState?.dailyGoal || 8}`;

  // 2. Charts
  renderTrendChart(currentTrendDays);
  renderTaskBreakdownChart();

  // 3. History Table
  renderHistoryTable();
}

function calculateStreak(history) {
  if (!history || history.length === 0) return 0;

  const pomoDays = new Set();
  history.forEach(h => {
    if (h.mode === 'pomodoro') {
      const d = new Date(h.timestamp);
      pomoDays.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
  });

  const now = new Date();
  let streak = 0;
  let checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const todayKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
  if (!pomoDays.has(todayKey)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const key = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
    if (pomoDays.has(key)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

function renderTrendChart(numDays) {
  if (!trendChartCanvas) return;
  const ctx = trendChartCanvas.getContext('2d');
  const width = trendChartCanvas.width;
  const height = trendChartCanvas.height;

  ctx.clearRect(0, 0, width, height);

  // Group by day
  const days = [];
  const now = new Date();
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push({
      dateStr: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
      label: numDays <= 7
        ? d.toLocaleDateString(undefined, { weekday: 'short' })
        : `${d.getMonth() + 1}/${d.getDate()}`,
      minutes: 0,
      pomos: 0
    });
  }

  historyState.forEach(h => {
    if (h.mode === 'pomodoro') {
      const d = new Date(h.timestamp);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const found = days.find(day => day.dateStr === key);
      if (found) {
        found.pomos++;
        found.minutes += (h.durationMinutes || 25);
      }
    }
  });

  const maxMinutes = Math.max(120, ...days.map(d => d.minutes));
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  // Grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#64748B';
  ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'right';

  for (let i = 0; i <= 4; i++) {
    const yVal = Math.round((maxMinutes / 4) * i);
    const y = paddingTop + chartH - (i / 4) * chartH;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();

    const hoursLabel = (yVal / 60).toFixed(1) + 'h';
    ctx.fillText(hoursLabel, paddingLeft - 8, y + 3);
  }

  // Draw Bars
  const barSpacing = chartW / days.length;
  const barWidth = Math.max(6, Math.min(28, barSpacing * 0.65));

  days.forEach((day, i) => {
    const x = paddingLeft + i * barSpacing + (barSpacing - barWidth) / 2;
    const barH = (day.minutes / maxMinutes) * chartH;
    const y = paddingTop + chartH - barH;

    // Background track
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    drawRoundedRect(ctx, x, paddingTop, barWidth, chartH, 3);
    ctx.fill();

    // Data bar
    if (day.minutes > 0) {
      const gradient = ctx.createLinearGradient(0, y, 0, paddingTop + chartH);
      gradient.addColorStop(0, '#EF4444');
      gradient.addColorStop(1, '#B91C1C');
      ctx.fillStyle = gradient;
      drawRoundedRect(ctx, x, y, barWidth, barH, 3);
      ctx.fill();

      // Top value text on 7-day view
      if (numDays <= 7 && day.pomos > 0) {
        ctx.fillStyle = '#CBD5E1';
        ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(day.pomos + '🍅', x + barWidth / 2, y - 5);
      }
    }

    // X-axis label
    ctx.fillStyle = '#94A3B8';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';

    // Show labels every 2 days if 30-day view
    if (numDays <= 7 || i % 4 === 0 || i === days.length - 1) {
      ctx.fillText(day.label, x + barWidth / 2, height - 10);
    }
  });
}

function renderTaskBreakdownChart() {
  if (!taskDistributionCanvas) return;
  const ctx = taskDistributionCanvas.getContext('2d');
  const width = taskDistributionCanvas.width;
  const height = taskDistributionCanvas.height;

  ctx.clearRect(0, 0, width, height);

  // Group by task title
  const taskMap = {};
  let totalTracked = 0;

  historyState.forEach(h => {
    if (h.mode === 'pomodoro') {
      const name = h.taskTitle || 'Unassigned Focus';
      taskMap[name] = (taskMap[name] || 0) + 1;
      totalTracked++;
    }
  });

  const sorted = Object.entries(taskMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  if (sorted.length === 0) {
    ctx.fillStyle = '#64748B';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No focus sessions logged yet.', width / 2, height / 2);
    return;
  }

  const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];
  const maxPomos = sorted[0][1];
  const barHeight = 18;
  const startY = 30;
  const gap = 36;

  sorted.forEach(([taskName, count], idx) => {
    const y = startY + idx * gap;
    const barWidth = Math.max(10, ((width - 120) * count) / maxPomos);

    // Label
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    const truncatedName = taskName.length > 20 ? taskName.substring(0, 18) + '...' : taskName;
    ctx.fillText(truncatedName, 10, y - 5);

    // Count tag
    ctx.fillStyle = '#94A3B8';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${count} pomos`, width - 10, y + 13);

    // Bar background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    drawRoundedRect(ctx, 10, y, width - 100, barHeight, 4);
    ctx.fill();

    // Bar foreground
    ctx.fillStyle = colors[idx % colors.length];
    drawRoundedRect(ctx, 10, y, barWidth, barHeight, 4);
    ctx.fill();
  });
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  if (width < radius * 2) radius = width / 2;
  if (height < radius * 2) radius = height / 2;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function renderHistoryTable() {
  const filter = historyFilterMode.value;
  const filtered = historyState.filter(h => {
    if (filter === 'all') return true;
    return h.mode === filter;
  });

  historyTableBody.innerHTML = '';

  if (filtered.length === 0) {
    historyTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">
          No session history recorded yet. Complete your first pomodoro to see it here!
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(entry => {
    const d = new Date(entry.timestamp);
    const dateFormatted = d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const timeFormatted = d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });

    const modeLabels = {
      pomodoro: 'Pomodoro',
      shortBreak: 'Short Break',
      longBreak: 'Long Break'
    };

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${dateFormatted} at ${timeFormatted}</td>
      <td>
        <span class="table-mode-badge badge-${entry.mode}">
          ${modeLabels[entry.mode] || entry.mode}
        </span>
      </td>
      <td>${entry.durationMinutes || 25} min</td>
      <td>${escapeHtml(entry.taskTitle || '—')}</td>
      <td>
        <button class="btn-del-row" title="Delete record" data-id="${entry.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </td>
    `;
    historyTableBody.appendChild(row);
  });
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[m]);
}

// ----------------- TAB 2: Task Planner -----------------
function renderTaskPlanner() {
  const pendingCount = tasksState.filter(t => !t.completed).length;
  tasksSummaryText.textContent = `${pendingCount} active task${pendingCount === 1 ? '' : 's'} remaining`;

  const filteredTasks = tasksState.filter(task => {
    if (currentDashTaskFilter === 'active') return !task.completed;
    if (currentDashTaskFilter === 'completed') return task.completed;
    return true;
  });

  dashTaskList.innerHTML = '';

  if (filteredTasks.length === 0) {
    dashTaskList.innerHTML = `
      <div class="empty-tasks" style="padding: 40px; text-align: center; color: var(--text-muted);">
        ${currentDashTaskFilter === 'completed' ? 'No completed tasks.' : 'No tasks created yet. Use the form above to add one!'}
      </div>
    `;
    return;
  }

  filteredTasks.forEach(task => {
    const isActive = timerState?.activeTaskId === task.id;
    const card = document.createElement('div');
    card.className = `dash-task-card ${isActive ? 'is-active' : ''} ${task.completed ? 'is-completed' : ''}`;

    // Generate tomato icons for estimation
    let tomatoIcons = '';
    const completed = task.completedPomodoros || 0;
    const total = Math.max(completed, task.estimatedPomodoros || 1);
    for (let i = 0; i < total; i++) {
      tomatoIcons += i < completed ? '🍅' : '⚪';
    }

    card.innerHTML = `
      <div class="dash-task-left">
        <input type="checkbox" class="task-checkbox dash-checkbox" ${task.completed ? 'checked' : ''} data-id="${task.id}">
        <span class="dash-task-title-text" title="${escapeHtml(task.title)}">${escapeHtml(task.title)}</span>
      </div>
      <div class="dash-task-right">
        <div class="pomo-visual-indicators" title="${completed} of ${task.estimatedPomodoros} estimated">${tomatoIcons}</div>
        <span class="pomo-badge-text">${completed} / ${task.estimatedPomodoros}</span>
        <button class="btn secondary btn-sm pin-dash-btn ${isActive ? 'active-btn' : ''}" data-id="${task.id}">
          ${isActive ? '★ Active' : '☆ Select'}
        </button>
        <button class="del-task-btn del-dash-btn" title="Delete Task" data-id="${task.id}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;
    dashTaskList.appendChild(card);
  });
}

// ----------------- TAB 3: Settings Form -----------------
function populateSettingsForm() {
  if (!settingsState) return;

  setPomodoroTime.value = settingsState.pomodoroTime || 25;
  setShortBreakTime.value = settingsState.shortBreakTime || 5;
  setLongBreakTime.value = settingsState.longBreakTime || 15;
  setLongBreakInterval.value = settingsState.longBreakInterval || 4;

  setAutoStartBreaks.checked = !!settingsState.autoStartBreaks;
  setAutoStartPomodoros.checked = !!settingsState.autoStartPomodoros;
  setDailyGoal.value = settingsState.dailyGoal || 8;

  setSoundNotification.checked = !!settingsState.soundNotification;
  setSoundType.value = settingsState.soundType || 'bell';
  setSoundVolume.value = settingsState.soundVolume || 80;
  soundVolVal.textContent = settingsState.soundVolume || 80;

  setAmbientSound.value = settingsState.ambientSound || 'none';
  setAmbientVolume.value = settingsState.ambientVolume || 30;
  ambientVolVal.textContent = settingsState.ambientVolume || 30;

  setDesktopNotification.checked = !!settingsState.desktopNotification;
  setShowBadgeTime.checked = !!settingsState.showBadgeTime;
  setTheme.value = settingsState.theme || 'dark';
}

// ----------------- Event Handlers -----------------
function setupNavigation() {
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      switchTab(item.dataset.tab);
    });
  });
}

function setupEventListeners() {
  // Chart Timeframe toggles
  chartTimeframePills.forEach(pill => {
    pill.addEventListener('click', () => {
      chartTimeframePills.forEach(p => p.classList.toggle('active', p === pill));
      currentTrendDays = parseInt(pill.dataset.timeframe, 10);
      renderTrendChart(currentTrendDays);
    });
  });

  // History Filter
  historyFilterMode.addEventListener('change', renderHistoryTable);

  // Clear History
  clearHistoryBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear your complete session history? This cannot be undone.')) {
      await ExtensionStorage.clearHistory();
      historyState = [];
      renderAnalytics();
    }
  });

  // Delete Individual History Row
  historyTableBody.addEventListener('click', async (e) => {
    const delBtn = e.target.closest('.btn-del-row');
    if (delBtn) {
      const id = delBtn.dataset.id;
      await ExtensionStorage.deleteHistoryEntry(id);
      historyState = historyState.filter(h => h.id !== id);
      renderAnalytics();
    }
  });

  // Export CSV
  exportCsvBtn.addEventListener('click', () => {
    if (historyState.length === 0) {
      alert('No history to export.');
      return;
    }

    const headers = ['ID', 'Date', 'Time', 'Mode', 'Duration_Minutes', 'Task_Title'];
    const rows = historyState.map(h => {
      const d = new Date(h.timestamp);
      const date = d.toISOString().split('T')[0];
      const time = d.toTimeString().split(' ')[0];
      return [
        h.id,
        date,
        time,
        h.mode,
        h.durationMinutes || 25,
        `"${(h.taskTitle || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadFile(csvContent, `pomodoro-history-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
  });

  // Backup JSON
  exportJsonBtn.addEventListener('click', () => {
    const backupData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      settings: settingsState,
      tasks: tasksState,
      history: historyState
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    downloadFile(jsonStr, `pomodoro-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  });

  // Restore JSON
  importJsonInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (imported.history && Array.isArray(imported.history)) {
          await chrome.storage.local.set({
            history: imported.history,
            tasks: imported.tasks || tasksState,
            settings: imported.settings || settingsState
          });
          await loadState();
          renderAll();
          alert('Backup restored successfully!');
        } else {
          alert('Invalid backup file format.');
        }
      } catch (err) {
        alert('Failed to parse backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // Task Planner Form
  dashAddTaskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = dashTaskTitle.value.trim();
    const est = parseInt(dashTaskEst.value, 10) || 1;
    if (title) {
      const task = await ExtensionStorage.addTask(title, est);
      if (!timerState.activeTaskId) {
        await ExtensionStorage.setTimer({ activeTaskId: task.id });
      }
      dashTaskTitle.value = '';
      dashTaskEst.value = '2';
      await loadState();
      renderTaskPlanner();
    }
  });

  // Task Filter Buttons
  dashFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dashFilterBtns.forEach(b => b.classList.toggle('active', b === btn));
      currentDashTaskFilter = btn.dataset.dashFilter;
      renderTaskPlanner();
    });
  });

  // Task List Delegation
  dashTaskList.addEventListener('click', async (e) => {
    const target = e.target;

    // Checkbox toggle
    const checkbox = target.closest('.dash-checkbox');
    if (checkbox) {
      const id = checkbox.dataset.id;
      await ExtensionStorage.updateTask(id, {
        completed: checkbox.checked,
        completedAt: checkbox.checked ? Date.now() : null
      });
      await loadState();
      renderTaskPlanner();
      return;
    }

    // Pin as active
    const pinBtn = target.closest('.pin-dash-btn');
    if (pinBtn) {
      const id = pinBtn.dataset.id;
      const newActive = timerState.activeTaskId === id ? null : id;
      await ExtensionStorage.setTimer({ activeTaskId: newActive });
      await loadState();
      renderTaskPlanner();
      return;
    }

    // Delete task
    const delBtn = target.closest('.del-dash-btn');
    if (delBtn) {
      const id = delBtn.dataset.id;
      await ExtensionStorage.deleteTask(id);
      await loadState();
      renderTaskPlanner();
      return;
    }
  });

  // Volume sliders live update
  setSoundVolume.addEventListener('input', () => {
    soundVolVal.textContent = setSoundVolume.value;
  });

  setAmbientVolume.addEventListener('input', () => {
    ambientVolVal.textContent = setAmbientVolume.value;
  });

  // Test Chime Sound
  testSoundBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({
      action: 'TEST_ALERT_SOUND',
      soundType: setSoundType.value,
      volume: parseInt(setSoundVolume.value, 10)
    });
  });

  // Save Settings
  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const updated = {
      pomodoroTime: parseInt(setPomodoroTime.value, 10) || 25,
      shortBreakTime: parseInt(setShortBreakTime.value, 10) || 5,
      longBreakTime: parseInt(setLongBreakTime.value, 10) || 15,
      longBreakInterval: parseInt(setLongBreakInterval.value, 10) || 4,
      autoStartBreaks: setAutoStartBreaks.checked,
      autoStartPomodoros: setAutoStartPomodoros.checked,
      dailyGoal: parseInt(setDailyGoal.value, 10) || 8,
      soundNotification: setSoundNotification.checked,
      soundType: setSoundType.value,
      soundVolume: parseInt(setSoundVolume.value, 10) || 80,
      ambientSound: setAmbientSound.value,
      ambientVolume: parseInt(setAmbientVolume.value, 10) || 30,
      desktopNotification: setDesktopNotification.checked,
      showBadgeTime: setShowBadgeTime.checked,
      theme: setTheme.value
    };

    settingsState = await ExtensionStorage.setSettings(updated);
    applyTheme(settingsState.theme);

    // Update idle mode durations to reflect new settings
    const timer = await ExtensionStorage.getTimer();
    const pomoDur = settingsState.pomodoroTime * 60 * 1000;
    const shortDur = settingsState.shortBreakTime * 60 * 1000;
    const longDur = settingsState.longBreakTime * 60 * 1000;

    if (timer.modeStates) {
      if (timer.modeStates.pomodoro?.status === 'idle') {
        timer.modeStates.pomodoro.duration = pomoDur;
        timer.modeStates.pomodoro.remainingMs = pomoDur;
      }
      if (timer.modeStates.shortBreak?.status === 'idle') {
        timer.modeStates.shortBreak.duration = shortDur;
        timer.modeStates.shortBreak.remainingMs = shortDur;
      }
      if (timer.modeStates.longBreak?.status === 'idle') {
        timer.modeStates.longBreak.duration = longDur;
        timer.modeStates.longBreak.remainingMs = longDur;
      }
      const curModeState = timer.modeStates[timer.mode];
      if (curModeState && curModeState.status === 'idle') {
        timer.duration = curModeState.duration;
        timer.remainingMs = curModeState.remainingMs;
      }
      await ExtensionStorage.setTimer(timer);
    }

    await chrome.runtime.sendMessage({ action: 'UPDATE_BADGE' });

    saveStatusToast.style.display = 'inline-block';
    setTimeout(() => {
      saveStatusToast.style.display = 'none';
    }, 2500);
  });

  // Listen to Storage Changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.timer) timerState = changes.timer.newValue;
      if (changes.tasks) tasksState = changes.tasks.newValue || [];
      if (changes.history) historyState = changes.history.newValue || [];
      if (changes.settings) {
        settingsState = changes.settings.newValue;
        applyTheme(settingsState.theme);
      }
      renderAnalytics();
      renderTaskPlanner();
    }
  });
}

function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Start
document.addEventListener('DOMContentLoaded', init);
