/**
 * Background Service Worker for Pomodoro Focus Pro
 * Manifest V3 compliant timer engine, alarm scheduler, badge manager, and notification dispatcher.
 */

importScripts('../shared/storage.js');

let offscreenCreating = null;

async function ensureOffscreenDocument() {
  if (offscreenCreating) {
    await offscreenCreating;
    return;
  }

  try {
    if (chrome.runtime.getContexts) {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL('offscreen/offscreen.html')]
      });
      if (contexts && contexts.length > 0) return;
    }
  } catch (e) {
    // getContexts might not be available in older Chrome builds
  }

  offscreenCreating = chrome.offscreen.createDocument({
    url: 'offscreen/offscreen.html',
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Play Pomodoro notification sounds and ambient focus audio'
  }).catch((err) => {
    // Ignore already created error
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
    await chrome.runtime.sendMessage({
      target: 'offscreen',
      action,
      ...params
    });
  } catch (e) {
    console.warn('Failed to dispatch audio message:', e);
  }
}

// ----------------- Badge Management -----------------
async function updateBadge() {
  const settings = await ExtensionStorage.getSettings();
  const timer = await ExtensionStorage.getTimer();

  if (!settings.showBadgeTime) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  // Set badge background color based on mode & status
  let badgeColor = '#EF4444'; // Pomodoro
  if (timer.status === 'paused') {
    badgeColor = '#F59E0B'; // Paused Amber
  } else if (timer.mode === 'shortBreak') {
    badgeColor = '#10B981'; // Green
  } else if (timer.mode === 'longBreak') {
    badgeColor = '#3B82F6'; // Blue
  }
  chrome.action.setBadgeBackgroundColor({ color: badgeColor });

  if (timer.status === 'running' && timer.targetEndTime) {
    const diffMs = Math.max(0, timer.targetEndTime - Date.now());
    const remainingMinutes = Math.ceil(diffMs / 60000);
    const badgeText = remainingMinutes < 1 ? '<1m' : `${remainingMinutes}m`;
    chrome.action.setBadgeText({ text: badgeText });
  } else if (timer.status === 'paused') {
    chrome.action.setBadgeText({ text: '||' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// ----------------- Timer Controls -----------------
async function startTimer() {
  const timer = await ExtensionStorage.getTimer();
  const settings = await ExtensionStorage.getSettings();

  const now = Date.now();
  let remainingMs = timer.remainingMs;

  if (timer.status === 'idle' || !remainingMs) {
    remainingMs = getModeDuration(timer.mode, settings);
  }

  const targetEndTime = now + remainingMs;

  await ExtensionStorage.setTimer({
    status: 'running',
    startedAt: now,
    targetEndTime,
    duration: getModeDuration(timer.mode, settings),
    remainingMs
  });

  // Schedule precise end alarm
  await chrome.alarms.clear('timer-end');
  await chrome.alarms.create('timer-end', { when: targetEndTime });

  // Schedule periodic 1-min alarm for badge tick
  await chrome.alarms.clear('timer-tick');
  await chrome.alarms.create('timer-tick', { periodInMinutes: 1 });

  // Ambient sound if enabled and in pomodoro mode
  if (timer.mode === 'pomodoro' && settings.ambientSound && settings.ambientSound !== 'none') {
    playAudio('startAmbient', {
      ambientType: settings.ambientSound,
      volume: settings.ambientVolume
    });
  }

  updateBadge();
}

async function pauseTimer() {
  const timer = await ExtensionStorage.getTimer();
  if (timer.status !== 'running') return;

  const now = Date.now();
  const remainingMs = Math.max(0, (timer.targetEndTime || now) - now);

  await chrome.alarms.clear('timer-end');
  await chrome.alarms.clear('timer-tick');

  await ExtensionStorage.setTimer({
    status: 'paused',
    targetEndTime: null,
    remainingMs
  });

  playAudio('stopAmbient');
  updateBadge();
}

async function resetTimer() {
  const timer = await ExtensionStorage.getTimer();
  const settings = await ExtensionStorage.getSettings();

  await chrome.alarms.clear('timer-end');
  await chrome.alarms.clear('timer-tick');

  const duration = getModeDuration(timer.mode, settings);

  await ExtensionStorage.setTimer({
    status: 'idle',
    targetEndTime: null,
    duration,
    remainingMs: duration
  });

  playAudio('stopAmbient');
  updateBadge();
}

async function skipTimer() {
  const timer = await ExtensionStorage.getTimer();
  const settings = await ExtensionStorage.getSettings();

  await chrome.alarms.clear('timer-end');
  await chrome.alarms.clear('timer-tick');
  playAudio('stopAmbient');

  // Transition to next mode without logging full completion
  let nextMode = 'pomodoro';
  let nextCycle = timer.cycleCount;

  if (timer.mode === 'pomodoro') {
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

  const duration = getModeDuration(nextMode, settings);

  await ExtensionStorage.setTimer({
    mode: nextMode,
    status: 'idle',
    targetEndTime: null,
    duration,
    remainingMs: duration,
    cycleCount: nextCycle
  });

  updateBadge();
}

async function switchMode(newMode) {
  const settings = await ExtensionStorage.getSettings();
  await chrome.alarms.clear('timer-end');
  await chrome.alarms.clear('timer-tick');
  playAudio('stopAmbient');

  const duration = getModeDuration(newMode, settings);

  await ExtensionStorage.setTimer({
    mode: newMode,
    status: 'idle',
    targetEndTime: null,
    duration,
    remainingMs: duration
  });

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

  if (timer.mode === 'pomodoro') {
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
    const isPomo = timer.mode === 'pomodoro';
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

  if (timer.mode === 'pomodoro') {
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

  if (shouldAutoStart) {
    const now = Date.now();
    const targetEndTime = now + nextDuration;

    await ExtensionStorage.setTimer({
      mode: nextMode,
      status: 'running',
      startedAt: now,
      targetEndTime,
      duration: nextDuration,
      remainingMs: nextDuration,
      cycleCount: nextCycle
    });

    await chrome.alarms.create('timer-end', { when: targetEndTime });
    await chrome.alarms.create('timer-tick', { periodInMinutes: 1 });

    if (nextMode === 'pomodoro' && settings.ambientSound && settings.ambientSound !== 'none') {
      playAudio('startAmbient', {
        ambientType: settings.ambientSound,
        volume: settings.ambientVolume
      });
    }
  } else {
    await ExtensionStorage.setTimer({
      mode: nextMode,
      status: 'idle',
      targetEndTime: null,
      duration: nextDuration,
      remainingMs: nextDuration,
      cycleCount: nextCycle
    });
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
