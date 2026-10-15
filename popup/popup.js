/**
 * Popup Script for Pomodoro Focus Pro
 * Real-time timer display, SVG ring animation, task manager, and mini-analytics.
 */

const CIRCLE_CIRCUMFERENCE = 596.9; // 2 * Math.PI * 95

let timerState = null;
let settingsState = null;
let tasksState = [];
let historyState = [];
let animationTimer = null;
let currentFilter = 'all';

// DOM Elements
const timeDisplay = document.getElementById('timeDisplay');
const statusLabel = document.getElementById('statusLabel');
const progressRing = document.getElementById('timerProgressRing');
const toggleBtn = document.getElementById('toggleBtn');
const toggleBtnText = document.getElementById('toggleBtnText');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');
const resetBtn = document.getElementById('resetBtn');
const skipBtn = document.getElementById('skipBtn');
const cycleIndicator = document.getElementById('cycleIndicator');

// Mode pills & Background Banner
const modePills = document.querySelectorAll('.mode-pill');
const bgRunningBanner = document.getElementById('bgRunningBanner');
const bgRunningText = document.getElementById('bgRunningText');
const bgSwitchBtn = document.getElementById('bgSwitchBtn');

// Active task widget
const activeTaskCard = document.getElementById('activeTaskCard');
const activeTaskEmpty = document.getElementById('activeTaskEmpty');
const activeTaskContent = document.getElementById('activeTaskContent');
const activeTaskTitle = document.getElementById('activeTaskTitle');
const activeTaskPomos = document.getElementById('activeTaskPomos');
const activeTaskCheckbox = document.getElementById('activeTaskCheckbox');
const clearActiveTaskBtn = document.getElementById('clearActiveTaskBtn');
const linkSelectTask = document.getElementById('linkSelectTask');

// Tasks Tab
const taskList = document.getElementById('taskList');
const addTaskForm = document.getElementById('addTaskForm');
const newTaskInput = document.getElementById('newTaskInput');
const newTaskEst = document.getElementById('newTaskEst');
const taskFilterBtns = document.querySelectorAll('.filter-chip');
const taskCountBadge = document.getElementById('taskCountBadge');

// Stats Tab
const statTodayPomos = document.getElementById('statTodayPomos');
const statTodayMinutes = document.getElementById('statTodayMinutes');
const statStreak = document.getElementById('statStreak');
const statGoalProgress = document.getElementById('statGoalProgress');
const chartTotalPomos = document.getElementById('chartTotalPomos');
const miniWeekCanvas = document.getElementById('miniWeekCanvas');

// Header & Navigation
const openDashboardBtn = document.getElementById('openDashboardBtn');
const openSettingsBtn = document.getElementById('openSettingsBtn');
const viewFullDashboardBtn = document.getElementById('viewFullDashboardBtn');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

// ----------------- Initialization -----------------
async function init() {
  await loadState();
  setupEventListeners();
  startRenderLoop();
}

async function loadState() {
  settingsState = await ExtensionStorage.getSettings();
  timerState = await ExtensionStorage.getTimer();
  tasksState = await ExtensionStorage.getTasks();
  historyState = await ExtensionStorage.getHistory();

  applyTheme(settingsState.theme);
  updateModeView(timerState.mode);
  renderCycleDots();
  renderActiveTaskWidget();
  renderTasks();
  renderStats();
}

function applyTheme(theme) {
  if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
  } else {
    document.body.setAttribute('data-theme', theme || 'dark');
  }
}

function updateModeView(mode) {
  document.body.classList.remove('mode-pomodoro', 'mode-shortBreak', 'mode-longBreak');
  document.body.classList.add(`mode-${mode}`);

  const activeRunning = timerState?.activeRunningMode;

  modePills.forEach(pill => {
    const pillMode = pill.dataset.mode;
    pill.classList.toggle('active', pillMode === mode);

    // Pill running indicator dot
    let dot = pill.querySelector('.pill-pulse-dot');
    if (activeRunning === pillMode) {
      if (!dot) {
        dot = document.createElement('span');
        dot.className = 'pill-pulse-dot';
        pill.appendChild(dot);
      }
    } else if (dot) {
      dot.remove();
    }
  });
}

function renderCycleDots() {
  const total = settingsState?.longBreakInterval || 4;
  const current = timerState?.cycleCount || 0;
  cycleIndicator.innerHTML = '';

  for (let i = 0; i < total; i++) {
    const dot = document.createElement('div');
    dot.className = `cycle-dot ${i < current ? 'completed' : ''}`;
    cycleIndicator.appendChild(dot);
  }
}

// ----------------- Real-time Timer Loop -----------------
function startRenderLoop() {
  if (animationTimer) cancelAnimationFrame(animationTimer);

  function tick() {
    renderTimer();
    animationTimer = requestAnimationFrame(tick);
  }
  tick();
}

function renderTimer() {
  if (!timerState) return;

  const currentMode = timerState.mode || 'pomodoro';
  const modeState = (timerState.modeStates && timerState.modeStates[currentMode]) || timerState;
  const now = Date.now();

  let remainingMs = modeState.remainingMs;
  if (modeState.status === 'running' && modeState.targetEndTime) {
    remainingMs = Math.max(0, modeState.targetEndTime - now);
  }

  // Format MM:SS
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  timeDisplay.textContent = timeStr;

  // Status Label
  if (modeState.status === 'running') {
    statusLabel.textContent = currentMode === 'pomodoro' ? 'Focusing' : 'Resting';
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
    toggleBtnText.textContent = 'Pause';
  } else if (modeState.status === 'paused') {
    statusLabel.textContent = 'Paused';
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
    toggleBtnText.textContent = 'Resume';
  } else {
    statusLabel.textContent = 'Ready';
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
    toggleBtnText.textContent = 'Start';
  }

  // Progress Ring
  const totalDuration = modeState.duration || (25 * 60 * 1000);
  const progressRatio = Math.max(0, Math.min(1, remainingMs / totalDuration));
  const offset = CIRCLE_CIRCUMFERENCE * (1 - progressRatio);
  progressRing.style.strokeDashoffset = offset;

  // Background Running Banner
  if (bgRunningBanner) {
    const runningMode = timerState.activeRunningMode;
    if (runningMode && runningMode !== currentMode) {
      const runningState = timerState.modeStates[runningMode];
      const otherRem = runningState?.targetEndTime ? Math.max(0, runningState.targetEndTime - now) : 0;
      const otherSec = Math.ceil(otherRem / 1000);
      const otherMin = Math.floor(otherSec / 60);
      const otherS = otherSec % 60;
      const otherTime = `${String(otherMin).padStart(2, '0')}:${String(otherS).padStart(2, '0')}`;

      const modeNames = { pomodoro: 'Focus', shortBreak: 'Short Break', longBreak: 'Long Break' };
      bgRunningBanner.style.display = 'flex';
      bgRunningText.textContent = `🍅 ${modeNames[runningMode]} running (${otherTime})`;
      bgSwitchBtn.textContent = `View`;
    } else {
      bgRunningBanner.style.display = 'none';
    }
  }
}

// ----------------- Active Task Widget -----------------
function renderActiveTaskWidget() {
  const activeTask = tasksState.find(t => t.id === timerState?.activeTaskId);

  if (activeTask) {
    activeTaskEmpty.style.display = 'none';
    activeTaskContent.style.display = 'flex';
    activeTaskTitle.textContent = activeTask.title;
    activeTaskPomos.textContent = `🍅 ${activeTask.completedPomodoros || 0} / ${activeTask.estimatedPomodoros || 1}`;
    activeTaskCheckbox.checked = !!activeTask.completed;
  } else {
    activeTaskEmpty.style.display = 'flex';
    activeTaskContent.style.display = 'none';
  }
}

// ----------------- Tasks Rendering & Logic -----------------
function renderTasks() {
  const pendingCount = tasksState.filter(t => !t.completed).length;
  if (pendingCount > 0) {
    taskCountBadge.style.display = 'inline-block';
    taskCountBadge.textContent = pendingCount;
  } else {
    taskCountBadge.style.display = 'none';
  }

  const filteredTasks = tasksState.filter(task => {
    if (currentFilter === 'active') return !task.completed;
    if (currentFilter === 'completed') return task.completed;
    return true;
  });

  taskList.innerHTML = '';

  if (filteredTasks.length === 0) {
    taskList.innerHTML = `
      <div class="empty-tasks">
        ${currentFilter === 'completed' ? 'No completed tasks yet.' : 'No tasks here. Add one above to start tracking!'}
      </div>
    `;
    return;
  }

  filteredTasks.forEach(task => {
    const isActive = timerState?.activeTaskId === task.id;
    const item = document.createElement('div');
    item.className = `task-item ${isActive ? 'active-task-row' : ''} ${task.completed ? 'completed-task' : ''}`;

    item.innerHTML = `
      <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} data-id="${task.id}">
      <span class="task-title" title="${escapeHtml(task.title)}">${escapeHtml(task.title)}</span>
      <span class="pomo-count-tag">🍅 ${task.completedPomodoros || 0}/${task.estimatedPomodoros || 1}</span>
      <div class="task-actions">
        <button class="pin-task-btn ${isActive ? 'is-active' : ''}" title="${isActive ? 'Active Task' : 'Set as Active Task'}" data-id="${task.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="${isActive ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </button>
        <button class="del-task-btn" title="Delete Task" data-id="${task.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;
    taskList.appendChild(item);
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

// ----------------- Stats Tab & Mini Chart -----------------
function renderStats() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  // Filter today's pomodoro sessions
  const todaySessions = historyState.filter(h => h.mode === 'pomodoro' && h.timestamp >= todayStart);
  const todayPomos = todaySessions.length;
  const todayMinutes = todaySessions.reduce((acc, h) => acc + (h.durationMinutes || 25), 0);

  statTodayPomos.textContent = todayPomos;
  statTodayMinutes.textContent = todayMinutes >= 60
    ? `${Math.floor(todayMinutes / 60)}h ${todayMinutes % 60}m`
    : `${todayMinutes}m`;

  const dailyGoal = settingsState?.dailyGoal || 8;
  statGoalProgress.textContent = `${todayPomos}/${dailyGoal}`;

  // Calculate Streak
  statStreak.textContent = calculateStreak(historyState);

  // Render 7-Day Mini Chart
  renderMiniChart();
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

  // Check if today has session, if not check yesterday to maintain streak
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

function renderMiniChart() {
  if (!miniWeekCanvas) return;
  const ctx = miniWeekCanvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const width = miniWeekCanvas.width;
  const height = miniWeekCanvas.height;

  ctx.clearRect(0, 0, width, height);

  // Prepare past 7 days (including today)
  const days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push({
      dateStr: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
      label: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
      count: 0
    });
  }

  // Count pomodoros
  let total7Days = 0;
  historyState.forEach(h => {
    if (h.mode === 'pomodoro') {
      const d = new Date(h.timestamp);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const found = days.find(day => day.dateStr === key);
      if (found) {
        found.count++;
        total7Days++;
      }
    }
  });

  chartTotalPomos.textContent = `${total7Days} this week`;

  const maxCount = Math.max(5, ...days.map(d => d.count));
  const paddingX = 20;
  const barSpacing = (width - paddingX * 2) / days.length;
  const barWidth = 18;
  const chartBottom = height - 24;
  const chartHeight = chartBottom - 20;

  days.forEach((day, i) => {
    const x = paddingX + i * barSpacing + (barSpacing - barWidth) / 2;
    const barH = (day.count / maxCount) * chartHeight;
    const y = chartBottom - barH;

    // Bar background track
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    drawRoundedRect(ctx, x, chartBottom - chartHeight, barWidth, chartHeight, 4);
    ctx.fill();

    // Actual bar
    if (day.count > 0) {
      ctx.fillStyle = '#EF4444';
      drawRoundedRect(ctx, x, y, barWidth, barH, 4);
      ctx.fill();

      // Number text above bar
      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(day.count, x + barWidth / 2, y - 4);
    }

    // Day label below
    ctx.fillStyle = i === 6 ? '#EF4444' : '#64748B';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(day.label, x + barWidth / 2, height - 6);
  });
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  if (height < radius) radius = height / 2;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// ----------------- Event Listeners -----------------
function setupEventListeners() {
  // Timer Controls
  toggleBtn.addEventListener('click', async () => {
    const currentMode = timerState.mode || 'pomodoro';
    const modeState = (timerState.modeStates && timerState.modeStates[currentMode]) || timerState;

    if (modeState.status === 'running') {
      await chrome.runtime.sendMessage({ action: 'PAUSE_TIMER', mode: currentMode });
    } else {
      await chrome.runtime.sendMessage({ action: 'START_TIMER', mode: currentMode });
    }
    await loadState();
  });

  resetBtn.addEventListener('click', async () => {
    const currentMode = timerState.mode || 'pomodoro';
    await chrome.runtime.sendMessage({ action: 'RESET_TIMER', mode: currentMode });
    await loadState();
  });

  skipBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'SKIP_TIMER' });
    await loadState();
  });

  // Switch to background running timer
  if (bgSwitchBtn) {
    bgSwitchBtn.addEventListener('click', async () => {
      if (timerState.activeRunningMode) {
        await chrome.runtime.sendMessage({ action: 'SWITCH_MODE', mode: timerState.activeRunningMode });
        await loadState();
      }
    });
  }

  // Mode Pills (switches view tab only, does NOT reset timer)
  modePills.forEach(pill => {
    pill.addEventListener('click', async () => {
      const mode = pill.dataset.mode;
      if (mode === timerState.mode) return;
      await chrome.runtime.sendMessage({ action: 'SWITCH_MODE', mode });
      await loadState();
    });
  });

  // Navigation Tabs
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.toggle('active', b === btn));
      tabPanes.forEach(pane => pane.classList.toggle('active', pane.id === `tab-${target}`));
      if (target === 'stats') {
        renderStats();
      }
    });
  });

  // Link to task tab from active task widget
  linkSelectTask.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelector('.tab-btn[data-tab="tasks"]').click();
  });

  // Active Task checkbox directly in timer view
  activeTaskCheckbox.addEventListener('change', async () => {
    if (timerState?.activeTaskId) {
      await ExtensionStorage.updateTask(timerState.activeTaskId, {
        completed: activeTaskCheckbox.checked,
        completedAt: activeTaskCheckbox.checked ? Date.now() : null
      });
      await loadState();
    }
  });

  clearActiveTaskBtn.addEventListener('click', async () => {
    await ExtensionStorage.setTimer({ activeTaskId: null });
    await loadState();
  });

  // Tasks form
  addTaskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = newTaskInput.value.trim();
    const est = parseInt(newTaskEst.value, 10) || 1;
    if (title) {
      const task = await ExtensionStorage.addTask(title, est);
      // Auto-select as active if none is active
      if (!timerState.activeTaskId) {
        await ExtensionStorage.setTimer({ activeTaskId: task.id });
      }
      newTaskInput.value = '';
      await loadState();
    }
  });

  // Task Filter chips
  taskFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      taskFilterBtns.forEach(b => b.classList.toggle('active', b === btn));
      currentFilter = btn.dataset.filter;
      renderTasks();
    });
  });

  // Task item click delegations (checkbox, pin, delete)
  taskList.addEventListener('click', async (e) => {
    const target = e.target;

    // Checkbox toggle
    const checkbox = target.closest('.task-checkbox');
    if (checkbox) {
      const id = checkbox.dataset.id;
      await ExtensionStorage.updateTask(id, {
        completed: checkbox.checked,
        completedAt: checkbox.checked ? Date.now() : null
      });
      await loadState();
      return;
    }

    // Pin as active task
    const pinBtn = target.closest('.pin-task-btn');
    if (pinBtn) {
      const id = pinBtn.dataset.id;
      const newActive = timerState.activeTaskId === id ? null : id;
      await ExtensionStorage.setTimer({ activeTaskId: newActive });
      await loadState();
      return;
    }

    // Delete task
    const delBtn = target.closest('.del-task-btn');
    if (delBtn) {
      const id = delBtn.dataset.id;
      await ExtensionStorage.deleteTask(id);
      await loadState();
      return;
    }
  });

  // Open Full Dashboard
  const openDashboard = (hash = '') => {
    const url = chrome.runtime.getURL(`dashboard/dashboard.html${hash}`);
    chrome.tabs.create({ url });
  };

  openDashboardBtn.addEventListener('click', () => openDashboard());
  openSettingsBtn.addEventListener('click', () => openDashboard('#settings'));
  viewFullDashboardBtn.addEventListener('click', () => openDashboard());

  // Listen to Storage Changes (Live sync with background & dashboard)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.timer) timerState = changes.timer.newValue;
      if (changes.settings) {
        settingsState = changes.settings.newValue;
        applyTheme(settingsState.theme);
      }
      if (changes.tasks) tasksState = changes.tasks.newValue || [];
      if (changes.history) historyState = changes.history.newValue || [];

      updateModeView(timerState.mode);
      renderCycleDots();
      renderActiveTaskWidget();
      renderTasks();
      renderStats();
    }
  });
}

// Start
document.addEventListener('DOMContentLoaded', init);
