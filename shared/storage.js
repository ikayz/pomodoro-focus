/**
 * Storage helpers and defaults for Pomodoro Focus Pro
 */

const DEFAULT_SETTINGS = {
  pomodoroTime: 25,        // in minutes
  shortBreakTime: 5,        // in minutes
  longBreakTime: 15,        // in minutes
  longBreakInterval: 4,     // pomodoros before long break
  autoStartBreaks: false,
  autoStartPomodoros: false,
  soundNotification: true,
  soundType: 'bell',        // 'bell' | 'marimba' | 'chime' | 'digital' | 'zen'
  soundVolume: 80,          // 0-100
  desktopNotification: true,
  showBadgeTime: true,
  dailyGoal: 8,             // target pomodoros per day
  theme: 'dark',            // 'dark' | 'light' | 'system'
  ambientSound: 'none',     // 'none' | 'whitenoise' | 'rain' | 'ticking'
  ambientVolume: 30         // 0-100
};

const DEFAULT_TIMER = {
  mode: 'pomodoro',         // 'pomodoro' | 'shortBreak' | 'longBreak'
  status: 'idle',           // 'idle' | 'running' | 'paused'
  duration: 25 * 60 * 1000, // milliseconds
  targetEndTime: null,      // timestamp in ms
  remainingMs: 25 * 60 * 1000,
  startedAt: null,
  cycleCount: 0,            // completed pomodoros in current set (0 to 3)
  activeTaskId: null
};

class ExtensionStorage {
  static async getSettings() {
    const res = await chrome.storage.local.get('settings');
    return { ...DEFAULT_SETTINGS, ...(res.settings || {}) };
  }

  static async setSettings(newSettings) {
    const current = await this.getSettings();
    const merged = { ...current, ...newSettings };
    await chrome.storage.local.set({ settings: merged });
    return merged;
  }

  static async getTimer() {
    const res = await chrome.storage.local.get('timer');
    return { ...DEFAULT_TIMER, ...(res.timer || {}) };
  }

  static async setTimer(newTimer) {
    const current = await this.getTimer();
    const merged = { ...current, ...newTimer };
    await chrome.storage.local.set({ timer: merged });
    return merged;
  }

  static async getTasks() {
    const res = await chrome.storage.local.get('tasks');
    return res.tasks || [];
  }

  static async setTasks(tasks) {
    await chrome.storage.local.set({ tasks });
    return tasks;
  }

  static async addTask(title, estimatedPomodoros = 1) {
    const tasks = await this.getTasks();
    const newTask = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      title: title.trim(),
      estimatedPomodoros: Math.max(1, parseInt(estimatedPomodoros, 10) || 1),
      completedPomodoros: 0,
      completed: false,
      createdAt: Date.now(),
      completedAt: null
    };
    tasks.unshift(newTask);
    await this.setTasks(tasks);
    return newTask;
  }

  static async updateTask(id, updates) {
    const tasks = await this.getTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx !== -1) {
      tasks[idx] = { ...tasks[idx], ...updates };
      await this.setTasks(tasks);
      return tasks[idx];
    }
    return null;
  }

  static async deleteTask(id) {
    let tasks = await this.getTasks();
    tasks = tasks.filter(t => t.id !== id);
    await this.setTasks(tasks);

    // If active task was deleted, unset active task
    const timer = await this.getTimer();
    if (timer.activeTaskId === id) {
      await this.setTimer({ activeTaskId: null });
    }
    return tasks;
  }

  static async getHistory() {
    const res = await chrome.storage.local.get('history');
    return res.history || [];
  }

  static async addHistoryEntry(entry) {
    const history = await this.getHistory();
    const newEntry = {
      id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      timestamp: Date.now(),
      mode: entry.mode || 'pomodoro',
      durationMinutes: entry.durationMinutes || 25,
      taskId: entry.taskId || null,
      taskTitle: entry.taskTitle || null
    };
    history.unshift(newEntry);
    await chrome.storage.local.set({ history });
    return newEntry;
  }

  static async clearHistory() {
    await chrome.storage.local.set({ history: [] });
  }

  static async deleteHistoryEntry(id) {
    let history = await this.getHistory();
    history = history.filter(h => h.id !== id);
    await chrome.storage.local.set({ history });
    return history;
  }
}

if (typeof window !== 'undefined') {
  window.ExtensionStorage = ExtensionStorage;
  window.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
  window.DEFAULT_TIMER = DEFAULT_TIMER;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ExtensionStorage, DEFAULT_SETTINGS, DEFAULT_TIMER };
}
