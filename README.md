# 🍅 Pomodoro Focus Pro

> A free, feature-rich Pomodoro Google Chrome Extension built with Manifest V3. Inspired by the simplicity of Marinara Pomodoro, but elevated with integrated task tracking, deep productivity analytics, procedural audio alerts, ambient focus sounds, and zero paywalls.

---

## 🌟 Why Focus Pro?

Most popular Pomodoro extensions lock essential productivity features (history longer than 7 days, CSV export, task lists, custom sounds) behind monthly subscription paywalls. **Pomodoro Focus Pro is 100% free, private, offline-first, and contains no paywalls, subscriptions, or tracking.**

| Feature | Marinara | Typical Paywalled Extensions | 🍅 Pomodoro Focus Pro |
| :--- | :---: | :---: | :---: |
| **Clean Timer & Toolbar Badge** | ✅ | ✅ | ✅ |
| **Custom Intervals (Pomo/Short/Long)** | ✅ | ✅ | ✅ |
| **Integrated Task Management** | ❌ | 🔒 Paid ($5/mo) | ✅ **Included** |
| **Estimated vs Actual Pomodoros** | ❌ | 🔒 Paid | ✅ **Included** |
| **Active Task in Timer View** | ❌ | 🔒 Paid | ✅ **Included** |
| **Lifetime History & Streaks** | ⚠️ Basic | 🔒 Paid | ✅ **Included** |
| **Interactive Canvas Trend Charts** | ❌ | 🔒 Paid | ✅ **Included** |
| **Task Breakdown Analytics** | ❌ | 🔒 Paid | ✅ **Included** |
| **Export to CSV & Backup to JSON** | ❌ | 🔒 Paid | ✅ **Included** |
| **Web Audio Synthesizer (5 Chimes)** | ⚠️ Sample files | ⚠️ Limited | ✅ **5 Procedural Sounds** |
| **Ambient Sounds (White noise, Rain, Tick)**| ❌ | 🔒 Paid | ✅ **Included** |
| **Manifest V3 Compliant & Zero-Build** | ❌ (Legacy MV2) | Varies | ✅ **Native MV3** |

---

## 🚀 Quick Installation Guide

You can load and run this extension in Chrome in under 30 seconds with zero build steps or npm installations:

1. Open Google Chrome.
2. In the address bar, navigate to:
   ```text
   chrome://extensions
   ```
3. In the top-right corner of the page, toggle **Developer mode** to **ON**.
4. In the top-left corner, click **Load unpacked**.
5. Select this project directory:
   ```text
   /Users/ikayz/development/side-projects/chrome_extension
   ```
6. Click the puzzle icon 🧩 in the Chrome toolbar, find **Pomodoro Focus Pro**, and click the pin icon 📌 to keep it visible on your toolbar.

---

## 💡 Key Features & How to Use

### 1. ⏱️ The Timer (Popup View)
- **Live Circular Dial**: An SVG progress ring smoothly illustrates the remaining time with color-coded modes:
  - 🔴 **Focus / Pomodoro**: Vibrant Red
  - 🟢 **Short Break**: Emerald Green
  - 🔵 **Long Break**: Ocean Blue
- **Toolbar Badge**: Displays remaining minutes (e.g. `25m`, `4m`) or pause state (`||`) right on the browser icon.
- **Cycle Tracker**: Visual indicator dots show your progress through the 4-pomodoro set.
- **Controls**:
  - `▶ Start` / `⏸ Pause`
  - `↻ Reset` (returns to period start)
  - `⏭ Skip` (advances to next period without penalty)

### 2. 📋 Integrated Task Management
- **Add Tasks**: Set title and estimated pomodoros (`🍅 1` to `10`).
- **Focus Linkage**: Click the star/pin icon on any task to set it as your **Active Task**. The timer popup and notifications will display and track progress against this specific task.
- **Automatic Increment**: When a focus session finishes, your active task automatically increments its completed pomodoro count.
- **Direct Checkoff**: Check tasks off directly from the timer dial or the task list.

### 3. 📊 Deep Analytics & Session History (Dashboard)
Click the expand icon ⤢ or options button in the popup to open the full-screen dashboard:
- **Lifetime Statistics**: All-time completed pomodoros, total focus hours, daily streak counter, and today's target.
- **Interactive Trend Charts**: 7-day and 30-day focus time charts drawn on high-DPI HTML5 Canvas.
- **Task Distribution**: Visual breakdown of which projects you spent the most time focusing on.
- **Detailed History Log**: Filter by mode (Pomodoro, Short Break, Long Break), delete single rows, or view date/time timestamps.
- **Export & Backup**:
  - 📥 **Export to CSV**: Download your history to open in Google Sheets or Microsoft Excel.
  - 💾 **Backup JSON**: Create a full snapshot of your settings, tasks, and history.
  - 📤 **Restore JSON**: Restore your data on a new device or browser profile.

### 4. 🔔 Procedural Audio & Ambient Focus (Web Audio API)
No missing `.mp3` files or licensing problems! Audio is procedurally synthesized:
- **Alert Sounds**:
  - 🔔 *Japanese Temple Bell* (Rich, warm harmonic decay)
  - 🪵 *Acoustic Marimba* (Gentle 4-note wooden melody)
  - ✨ *Crystalline Chime* (Rising bright arpeggio)
  - 📟 *Retro Digital Beep* (Classic dual-tone beep)
  - 🧘 *Zen Singing Bowl* (Deep resonant Tibetan gong)
- **Ambient Focus Sounds**:
  - Gentle White / Pink Noise
  - Soothing Rain Shower
  - Mechanical Clock Ticking

### 5. ⌨️ Keyboard Shortcuts
Control your timer instantly from any web page without opening the popup:
- `Alt + Shift + P`: Start / Pause Timer
- `Alt + Shift + S`: Skip to Next Period
- `Alt + Shift + R`: Reset Current Timer

*(You can customize these shortcuts anytime at `chrome://extensions/shortcuts`)*

---

## 🛠️ Project Structure

```text
chrome_extension/
├── manifest.json              # Manifest V3 configuration & permissions
├── background/
│   └── background.js          # Service worker (alarms, badge, timer state, notifications)
├── offscreen/
│   ├── offscreen.html         # Offscreen audio player for MV3 background alerts
│   └── offscreen.js           # Audio playback dispatcher
├── popup/
│   ├── popup.html             # Extension dropdown window
│   ├── popup.css              # Styling for dial, tabs, and tasks
│   └── popup.js               # Popup event handler & real-time loop
├── dashboard/
│   ├── dashboard.html         # Full-page analytics, task planner & settings
│   ├── dashboard.css          # Dashboard layout & responsive styling
│   └── dashboard.js           # Canvas charts, CSV/JSON export/import & settings logic
├── shared/
│   ├── storage.js             # Promise-based storage interface & data models
│   ├── audio-synth.js         # Web Audio procedural synthesis engine
│   └── theme.css              # Design tokens, variables & dark/light styles
├── icons/                     # 16px, 32px, 48px, 128px PNGs & SVG source
└── README.md
```

---

## 🔒 Privacy & Permissions

This extension runs **100% locally** on your machine.
- `storage`: Saves your tasks, history, and preferences inside `chrome.storage.local`.
- `alarms`: Schedules timer completions and toolbar badge updates.
- `notifications`: Displays desktop notifications when focus or break sessions end.
- `offscreen`: Enables Web Audio playback for chimes and ambient sounds in Manifest V3.

No data ever leaves your computer. No analytics, tracking, or network requests are made.
