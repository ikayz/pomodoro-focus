/**
 * Alert Modal Script for Pomodoro Focus Pro
 * Plays chime immediately in active window and provides 1-click continuation.
 */

const synth = new AudioSynth();

async function initAlert() {
  const urlParams = new URLSearchParams(window.location.search);
  const completedMode = urlParams.get('mode') || 'pomodoro';
  const nextMode = urlParams.get('next') || (completedMode === 'pomodoro' ? 'shortBreak' : 'pomodoro');
  const taskTitle = urlParams.get('task') || '';

  const settings = await ExtensionStorage.getSettings();
  const timer = await ExtensionStorage.getTimer();

  // Apply theme
  if (settings.theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
  } else {
    document.body.setAttribute('data-theme', settings.theme || 'dark');
  }

  // Set accent mode to tint colors towards the NEXT action
  document.body.classList.remove('mode-pomodoro', 'mode-shortBreak', 'mode-longBreak');
  document.body.classList.add(`mode-${nextMode}`);

  // Play audio chime immediately
  if (settings.soundNotification) {
    synth.playAlert(settings.soundType || 'bell', settings.soundVolume || 80);
  }

  // DOM Elements
  const alertIcon = document.getElementById('alertIcon');
  const alertTitle = document.getElementById('alertTitle');
  const alertSubtitle = document.getElementById('alertSubtitle');
  const alertTaskBanner = document.getElementById('alertTaskBanner');
  const alertTaskTitle = document.getElementById('alertTaskTitle');
  const primaryActionBtn = document.getElementById('primaryActionBtn');
  const primaryActionIcon = document.getElementById('primaryActionIcon');
  const primaryActionText = document.getElementById('primaryActionText');
  const dismissBtn = document.getElementById('dismissBtn');
  const cycleText = document.getElementById('cycleText');
  const replaySoundBtn = document.getElementById('replaySoundBtn');

  // Populate cycle progress
  const interval = settings.longBreakInterval || 4;
  const currentCycle = timer.cycleCount || 0;
  cycleText.textContent = `Completed ${currentCycle} of ${interval} pomodoros in cycle`;

  // Customize UI according to completed mode
  if (completedMode === 'pomodoro') {
    alertIcon.textContent = '🍅';
    alertTitle.textContent = 'Pomodoro Finished!';
    alertSubtitle.textContent = 'Great focus session! Time to step away and recharge.';

    if (nextMode === 'longBreak') {
      primaryActionIcon.textContent = '🛋️';
      primaryActionText.textContent = `Start Long Break (${settings.longBreakTime}m)`;
    } else {
      primaryActionIcon.textContent = '☕';
      primaryActionText.textContent = `Start Break (${settings.shortBreakTime}m)`;
    }

    if (taskTitle) {
      alertTaskBanner.style.display = 'flex';
      alertTaskTitle.textContent = taskTitle;
    }
  } else {
    // Coming from break
    alertIcon.textContent = '☕';
    alertTitle.textContent = 'Break Finished!';
    alertSubtitle.textContent = 'Feeling refreshed? Ready to tackle your next focus session?';

    primaryActionIcon.textContent = '🍅';
    primaryActionText.textContent = `Start Focus (${settings.pomodoroTime}m)`;
  }

  // Action listeners
  primaryActionBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'START_TIMER', mode: nextMode });
    window.close();
  });

  dismissBtn.addEventListener('click', () => {
    window.close();
  });

  replaySoundBtn.addEventListener('click', () => {
    synth.playAlert(settings.soundType || 'bell', settings.soundVolume || 80);
  });

  // Keyboard accessibility
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      primaryActionBtn.click();
    } else if (e.key === 'Escape') {
      dismissBtn.click();
    }
  });
}

document.addEventListener('DOMContentLoaded', initAlert);
