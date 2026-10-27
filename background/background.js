/**
 * Background Service Worker for Pomodoro Focus Pro
 * Manifest V3 compliant timer engine, alarm scheduler, badge manager, and notification dispatcher.
 */

importScripts('../shared/storage.js');

let offscreenCreating = null;

let activeAlertWindowId = null;

async function ensureOffscreenDocument() {
  if (offscreenCreating) {
    await offscreenCreating;
    return;
  }

  try {
    if (chrome.offscreen?.hasDocument) {
      const hasDoc = await chrome.offscreen.hasDocument();
      if (hasDoc) return;
    } else if (chrome.runtime.getContexts) {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL('offscreen/offscreen.html')]
      });
      if (contexts && contexts.length > 0) return;
    }
  } catch (e) {
    // Context check fallback
  }

  offscreenCreating = chrome.offscreen.createDocument({
    url: 'offscreen/offscreen.html',
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Play Pomodoro notification sounds and ambient focus audio'
  }).catch((err) => {
    if (!err.message.includes('Only a single offscreen document may be created')) {
      console.warn('Offscreen document creation error:', err);
    }
  }).finally(() => {
    offscreenCreating = null;
  });

  await offscreenCreating;
}

async function playAudio(action, params = {}) {
  try {
    await ensureOffscreenDocument();
    // Quick retry handshake to ensure offscreen script has mounted
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await chrome.runtime.sendMessage({
          target: 'offscreen',
          action,
          ...params
        });
        if (res) break;
      } catch (err) {
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 60));
        } else {
          console.warn('Failed to dispatch audio message:', err);
        }
      }
    }
  } catch (e) {
    console.warn('Failed to dispatch audio message:', e);
  }
}

async function openAlertWindow(completedMode, nextMode, taskTitle = null) {
  try {
    if (activeAlertWindowId !== null) {
      try {
        await chrome.windows.remove(activeAlertWindowId);
      } catch (e) {}
      activeAlertWindowId = null;
    }

    const currentWin = await chrome.windows.getLastFocused().catch(() => null);
    let left = undefined;
    let top = undefined;
    const width = 450;
    const height = 310;

    if (currentWin && currentWin.left !== undefined && currentWin.width) {
      left = Math.round(currentWin.left + (currentWin.width - width) / 2);
      top = Math.round(currentWin.top + (currentWin.height - height) / 2);
    }

    let alertUrl = `alert/alert.html?mode=${encodeURIComponent(completedMode)}&next=${encodeURIComponent(nextMode)}`;
    if (taskTitle) {
      alertUrl += `&task=${encodeURIComponent(taskTitle)}`;
    }

    const win = await chrome.windows.create({
      url: chrome.runtime.getURL(alertUrl),
      type: 'popup',
      width,
      height,
      focused: true,
      left,
      top
    });

    if (win) {
      activeAlertWindowId = win.id;
    }
  } catch (err) {
    console.warn('Failed to open alert window:', err);
  }
}

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === activeAlertWindowId) {
    activeAlertWindowId = null;
  }
});

// ----------------- Badge Management -----------------
async function updateBadge() {
  const settings = await ExtensionStorage.getSettings();
  const timer = await ExtensionStorage.getTimer();

  if (!settings.showBadgeTime) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  // Display badge for the active running mode, or fall back to the displayed mode
  const activeMode = timer.activeRunningMode || timer.mode || 'pomodoro';
  const modeState = (timer.modeStates && timer.modeStates[activeMode]) || timer;

  let badgeColor = '#EF4444'; // Pomodoro Red
  if (modeState.status === 'paused') {
    badgeColor = '#F59E0B'; // Paused Amber
  } else if (activeMode === 'shortBreak') {
    badgeColor = '#10B981'; // Green
  } else if (activeMode === 'longBreak') {
    badgeColor = '#3B82F6'; // Blue
  }
  chrome.action.setBadgeBackgroundColor({ color: badgeColor });

  if (modeState.status === 'running' && modeState.targetEndTime) {
    const diffMs = Math.max(0, modeState.targetEndTime - Date.now());
    const remainingMinutes = Math.ceil(diffMs / 60000);
    const badgeText = remainingMinutes < 1 ? '<1m' : `${remainingMinutes}m`;
    chrome.action.setBadgeText({ text: badgeText });
  } else if (modeState.status === 'paused') {
    chrome.action.setBadgeText({ text: '||' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// ----------------- Timer Controls -----------------
async function startTimer(targetMode = null) {
  const timer = await ExtensionStorage.getTimer();
  const settings = await ExtensionStorage.getSettings();
  const mode = targetMode || timer.mode || 'pomodoro';

  const now = Date.now();
  const modeState = timer.modeStates[mode] || {
    status: 'idle',
    duration: getModeDuration(mode, settings),
    remainingMs: getModeDuration(mode, settings),
    targetEndTime: null
  };

  // If another mode is currently running, pause it first
  if (timer.activeRunningMode && timer.activeRunningMode !== mode) {
    const prevRunningMode = timer.activeRunningMode;
    const prevRunningState = timer.modeStates[prevRunningMode];
    if (prevRunningState && prevRunningState.status === 'running') {
      const remainingPrev = Math.max(0, (prevRunningState.targetEndTime || now) - now);
      prevRunningState.status = 'paused';
      prevRunningState.targetEndTime = null;
      prevRunningState.remainingMs = remainingPrev;
    }
  }

  let remainingMs = modeState.remainingMs;
  if (modeState.status === 'idle' || !remainingMs) {
    remainingMs = getModeDuration(mode, settings);
    modeState.duration = remainingMs;
  }

  const targetEndTime = now + remainingMs;

  modeState.status = 'running';
  modeState.startedAt = now;
  modeState.targetEndTime = targetEndTime;
  modeState.remainingMs = remainingMs;

  timer.modeStates[mode] = modeState;
  timer.activeRunningMode = mode;
  timer.mode = mode;
  timer.status = 'running';
  timer.targetEndTime = targetEndTime;
  timer.duration = modeState.duration;
  timer.remainingMs = remainingMs;

  await ExtensionStorage.setTimer(timer);

  // Schedule precise end alarm
  await chrome.alarms.clear('timer-end');
  await chrome.alarms.create('timer-end', { when: targetEndTime });

  // Schedule periodic 1-min alarm for badge tick
  await chrome.alarms.clear('timer-tick');
  await chrome.alarms.create('timer-tick', { periodInMinutes: 1 });

  // Ambient sound if enabled and in pomodoro mode
  if (mode === 'pomodoro' && settings.ambientSound && settings.ambientSound !== 'none') {
    playAudio('startAmbient', {
      ambientType: settings.ambientSound,
      volume: settings.ambientVolume
    });
  } else {
    playAudio('stopAmbient');
  }

  updateBadge();
}

async function pauseTimer(targetMode = null) {
  const timer = await ExtensionStorage.getTimer();
  const mode = targetMode || timer.activeRunningMode || timer.mode || 'pomodoro';
  const modeState = timer.modeStates[mode];

  if (!modeState || modeState.status !== 'running') return;

  const now = Date.now();
  const remainingMs = Math.max(0, (modeState.targetEndTime || now) - now);

  modeState.status = 'paused';
  modeState.targetEndTime = null;
  modeState.remainingMs = remainingMs;

  if (timer.activeRunningMode === mode) {
    await chrome.alarms.clear('timer-end');
    await chrome.alarms.clear('timer-tick');
    timer.activeRunningMode = null;
    playAudio('stopAmbient');
  }

  timer.modeStates[mode] = modeState;
  if (timer.mode === mode) {
    timer.status = 'paused';
    timer.targetEndTime = null;
    timer.remainingMs = remainingMs;
  }

  await ExtensionStorage.setTimer(timer);
  updateBadge();
}

async function resetTimer(targetMode = null) {
  const timer = await ExtensionStorage.getTimer();
  const settings = await ExtensionStorage.getSettings();
  const mode = targetMode || timer.mode || 'pomodoro';

  if (timer.activeRunningMode === mode) {
    await chrome.alarms.clear('timer-end');
    await chrome.alarms.clear('timer-tick');
    timer.activeRunningMode = null;
    playAudio('stopAmbient');
  }

  const duration = getModeDuration(mode, settings);

  timer.modeStates[mode] = {
    status: 'idle',
    targetEndTime: null,
    duration,
    remainingMs: duration,
    startedAt: null
  };

  if (timer.mode === mode) {
    timer.status = 'idle';
    timer.targetEndTime = null;
    timer.duration = duration;
    timer.remainingMs = duration;
  }

  await ExtensionStorage.setTimer(timer);
  updateBadge();
}

async function skipTimer() {
  const timer = await ExtensionStorage.getTimer();
  const settings = await ExtensionStorage.getSettings();

  const activeMode = timer.activeRunningMode || timer.mode;

  if (timer.activeRunningMode) {
    await chrome.alarms.clear('timer-end');
    await chrome.alarms.clear('timer-tick');
    playAudio('stopAmbient');
    timer.activeRunningMode = null;
  }

  // Reset the mode that was skipped
  const currDuration = getModeDuration(activeMode, settings);
  if (timer.modeStates[activeMode]) {
    timer.modeStates[activeMode] = {
      status: 'idle',
      targetEndTime: null,
      duration: currDuration,
      remainingMs: currDuration,
      startedAt: null
    };
  }

  // Determine next mode in cycle
  let nextMode = 'pomodoro';
  let nextCycle = timer.cycleCount;

  if (activeMode === 'pomodoro') {
    nextCycle = timer.cycleCount + 1;
    if (nextCycle >= settings.longBreakInterval) {
      nextMode = 'longBreak';
      nextCycle = 0;
    } else {
      nextMode = 'shortBreak';
    }
  } else {
    nextMode = 'pomodoro';
  }

  const nextDuration = getModeDuration(nextMode, settings);

  timer.mode = nextMode;
  timer.cycleCount = nextCycle;
  timer.status = 'idle';
  timer.targetEndTime = null;
  timer.duration = nextDuration;
  timer.remainingMs = nextDuration;

  if (timer.modeStates[nextMode]) {
    timer.modeStates[nextMode] = {
      status: 'idle',
      targetEndTime: null,
      duration: nextDuration,
      remainingMs: nextDuration,
      startedAt: null
    };
  }

  await ExtensionStorage.setTimer(timer);
  updateBadge();
}

async function switchMode(newMode) {
  const timer = await ExtensionStorage.getTimer();
  const settings = await ExtensionStorage.getSettings();

  // Simply switch the displayed mode tab.
  // DO NOT clear alarms, DO NOT cancel running timers, DO NOT reset progress!
  timer.mode = newMode;

  const modeState = timer.modeStates[newMode];
  if (modeState && modeState.status === 'idle') {
    const dur = getModeDuration(newMode, settings);
    modeState.duration = dur;
    modeState.remainingMs = dur;
  }

  // Reflect viewed mode in top-level fields
  const currentView = timer.modeStates[newMode] || { status: 'idle' };
  timer.status = currentView.status;
  timer.targetEndTime = currentView.targetEndTime;
  timer.remainingMs = currentView.remainingMs;
  timer.duration = currentView.duration;

  await ExtensionStorage.setTimer(timer);
  updateBadge();
}

function getModeDuration(mode, settings) {
  switch (mode) {
    case 'shortBreak':
      return settings.shortBreakTime * 60 * 1000;
    case 'longBreak':
      return settings.longBreakTime * 60 * 1000;
    case 'pomodoro':
    default:
      return settings.pomodoroTime * 60 * 1000;
  }
}

// ----------------- Alarm & Notification Handling -----------------
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'timer-tick') {
    updateBadge();
    return;
  }

  if (alarm.name === 'timer-end') {
    await handleTimerComplete();
  }
});

async function handleTimerComplete() {
  const timer = await ExtensionStorage.getTimer();
  const settings = await ExtensionStorage.getSettings();
  const tasks = await ExtensionStorage.getTasks();

  await chrome.alarms.clear('timer-end');
  await chrome.alarms.clear('timer-tick');
  playAudio('stopAmbient');

  const completedMode = timer.activeRunningMode || timer.mode || 'pomodoro';
  timer.activeRunningMode = null;

  // Reset the completed mode
  const completedModeDuration = getModeDuration(completedMode, settings);
  if (timer.modeStates[completedMode]) {
    timer.modeStates[completedMode] = {
      status: 'idle',
      targetEndTime: null,
      duration: completedModeDuration,
      remainingMs: completedModeDuration,
      startedAt: null
    };
  }

  // 1. Play alert chime
  if (settings.soundNotification) {
    playAudio('playAlert', {
      soundType: settings.soundType,
      volume: settings.soundVolume
    });
  }

  // 2. Log History & Task Progress
  let activeTask = null;
  if (timer.activeTaskId) {
    activeTask = tasks.find(t => t.id === timer.activeTaskId);
  }

  if (completedMode === 'pomodoro') {
    await ExtensionStorage.addHistoryEntry({
      mode: 'pomodoro',
      durationMinutes: settings.pomodoroTime,
      taskId: timer.activeTaskId || null,
      taskTitle: activeTask ? activeTask.title : null
    });

    if (activeTask) {
      await ExtensionStorage.updateTask(activeTask.id, {
        completedPomodoros: (activeTask.completedPomodoros || 0) + 1
      });
    }
  }

  // 3. Desktop Notification
  if (settings.desktopNotification) {
    const isPomo = completedMode === 'pomodoro';
    const title = isPomo ? '🍅 Pomodoro Finished!' : '☕ Break Completed!';
    const message = isPomo
      ? (activeTask ? `Great work on "${activeTask.title}"! Take a well-deserved break.` : 'Great focus session! Time to stretch and relax.')
      : 'Break is over. Ready to jump back in?';

    chrome.notifications.create('pomo-complete-alert', {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title,
      message,
      priority: 2,
      buttons: [
        { title: isPomo ? 'Take Break' : 'Start Pomodoro' },
        { title: 'Dismiss' }
      ]
    });
  }

  // 4. Determine Next Mode & Cycle
  let nextMode = 'pomodoro';
  let nextCycle = timer.cycleCount;

  if (completedMode === 'pomodoro') {
    nextCycle = timer.cycleCount + 1;
    if (nextCycle >= settings.longBreakInterval) {
      nextMode = 'longBreak';
      nextCycle = 0;
    } else {
      nextMode = 'shortBreak';
    }
  } else {
    nextMode = 'pomodoro';
  }

  const nextDuration = getModeDuration(nextMode, settings);

  // Check auto-start rules
  const shouldAutoStart = (nextMode !== 'pomodoro' && settings.autoStartBreaks) ||
                          (nextMode === 'pomodoro' && settings.autoStartPomodoros);

  timer.mode = nextMode;
  timer.cycleCount = nextCycle;

  if (shouldAutoStart) {
    const now = Date.now();
    const targetEndTime = now + nextDuration;

    timer.activeRunningMode = nextMode;
    timer.status = 'running';
    timer.startedAt = now;
    timer.targetEndTime = targetEndTime;
    timer.duration = nextDuration;
    timer.remainingMs = nextDuration;

    if (timer.modeStates[nextMode]) {
      timer.modeStates[nextMode] = {
        status: 'running',
        startedAt: now,
        targetEndTime,
        duration: nextDuration,
        remainingMs: nextDuration
      };
    }

    await ExtensionStorage.setTimer(timer);

    await chrome.alarms.create('timer-end', { when: targetEndTime });
    await chrome.alarms.create('timer-tick', { periodInMinutes: 1 });

    if (nextMode === 'pomodoro' && settings.ambientSound && settings.ambientSound !== 'none') {
      playAudio('startAmbient', {
        ambientType: settings.ambientSound,
        volume: settings.ambientVolume
      });
    }
  } else {
    timer.status = 'idle';
    timer.targetEndTime = null;
    timer.duration = nextDuration;
    timer.remainingMs = nextDuration;

    if (timer.modeStates[nextMode]) {
      timer.modeStates[nextMode] = {
        status: 'idle',
        startedAt: null,
        targetEndTime: null,
        duration: nextDuration,
        remainingMs: nextDuration
      };
    }

    await ExtensionStorage.setTimer(timer);
  }

  // 5. Open Alert Popup Window signaling the end of focus/break with 1-click button
  if (settings.openAlertWindow !== false) {
    await openAlertWindow(completedMode, nextMode, activeTask ? activeTask.title : null);
  }

  updateBadge();
}

// ----------------- Notification Actions -----------------
chrome.notifications.onButtonClicked.addListener(async (notifId, btnIdx) => {
  if (notifId === 'pomo-complete-alert') {
    if (btnIdx === 0) {
      // "Take Break" or "Start Pomodoro"
      await startTimer();
    }
    chrome.notifications.clear(notifId);
  }
});

chrome.notifications.onClicked.addListener((notifId) => {
  chrome.notifications.clear(notifId);
});

// ----------------- Keyboard Shortcuts -----------------
chrome.commands.onCommand.addListener(async (command) => {
  const timer = await ExtensionStorage.getTimer();
  switch (command) {
    case 'toggle-timer':
      if (timer.status === 'running') {
        await pauseTimer();
      } else {
        await startTimer();
      }
      break;
    case 'skip-timer':
      await skipTimer();
      break;
    case 'reset-timer':
      await resetTimer();
      break;
  }
});

// ----------------- Message Handling from Popup / Dashboard -----------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.action) {
      case 'START_TIMER':
        await startTimer();
        sendResponse({ status: 'started' });
        break;

      case 'PAUSE_TIMER':
        await pauseTimer();
        sendResponse({ status: 'paused' });
        break;

      case 'RESET_TIMER':
        await resetTimer();
        sendResponse({ status: 'reset' });
        break;

      case 'SKIP_TIMER':
        await skipTimer();
        sendResponse({ status: 'skipped' });
        break;

      case 'SWITCH_MODE':
        await switchMode(message.mode);
        sendResponse({ status: 'switched' });
        break;

      case 'UPDATE_BADGE':
        await updateBadge();
        sendResponse({ status: 'updated' });
        break;

      case 'TEST_ALERT_SOUND':
        await playAudio('playAlert', {
          soundType: message.soundType,
          volume: message.volume
        });
        sendResponse({ status: 'played' });
        break;

      default:
        sendResponse({ status: 'unknown' });
    }
  })();
  return true; // Keep message channel open for async response
});

// Initialize on install or startup
chrome.runtime.onInstalled.addListener(async () => {
  const settings = await ExtensionStorage.getSettings();
  const timer = await ExtensionStorage.getTimer();
  updateBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  const timer = await ExtensionStorage.getTimer();
  if (timer.status === 'running' && timer.targetEndTime) {
    // If browser was restarted while timer was supposed to be running
    if (Date.now() >= timer.targetEndTime) {
      await handleTimerComplete();
    } else {
      await chrome.alarms.create('timer-end', { when: timer.targetEndTime });
      await chrome.alarms.create('timer-tick', { periodInMinutes: 1 });
      updateBadge();
    }
  } else {
    updateBadge();
  }
});
