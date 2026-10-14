/**
 * Offscreen audio player for Pomodoro Focus Pro
 * Runs Web Audio synthesis in Manifest V3 without user interaction blocking.
 */

const synth = new AudioSynth();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  switch (message.action) {
    case 'playAlert':
      synth.playAlert(message.soundType || 'bell', message.volume || 80);
      sendResponse({ status: 'ok' });
      break;

    case 'startAmbient':
      synth.startAmbient(message.ambientType, message.volume || 30);
      sendResponse({ status: 'ok' });
      break;

    case 'stopAmbient':
      synth.stopAmbient();
      sendResponse({ status: 'ok' });
      break;

    default:
      sendResponse({ status: 'unknown_action' });
  }
  return true;
});
