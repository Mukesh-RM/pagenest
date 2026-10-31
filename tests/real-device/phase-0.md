# Phase 0 real-device checklist

**Gate (blueprint section 18):** the app installs on Android and iPhone and opens offline.
**Time:** about 15 minutes. **You need:** one Android phone with Chrome, one iPhone with Safari, and the InkQuiet link (the `*.pages.dev` preview address).
**Tester:** ____________  **Date:** ____________  **Build / commit:** ____________  **Link:** ____________

Tick each box, or write FAIL and a short note. A screenshot of any FAIL helps. Do the Android section, then the iPhone section.

## A. Android (Chrome)

Device and Android version: ______________________

1. [ ] **Open the link** in Chrome. The Library screen shows within about 3 seconds on mobile data. No login, ad or cookie banner appears.
2. [ ] **Install.** Use the Chrome menu, then Install app (or Add to Home Screen). An icon named "InkQuiet" appears on the home screen, and the icon is not cropped or cut off.
3. [ ] **Launch from the icon.** It opens full screen with no browser address bar, and the splash screen is in the app colours.
4. [ ] **Offline launch.** Open the app once, then swipe it away. Turn on airplane mode (Wi-Fi and mobile data off). Launch from the icon. The Library screen appears in about 1 second.
5. [ ] **Tabs offline.** Still in airplane mode, tap Library, Collections, Stats, Settings. Each screen opens, and the active tab is highlighted.
6. [ ] **Reload offline.** In Settings, pull down to refresh or swipe the app away and reopen it. You land back in the app, not on a "no internet" page.
7. [ ] **Safe areas.** The top bar or title does not sit under the status bar or camera cut-out. The bottom tab bar does not sit under the gesture bar. Rotate to landscape: nothing hides behind the cut-out.
8. [ ] **Theme.** Settings, Theme: choose Dark, Sepia, Black, then Light. Each changes the whole screen at once. Text is easy to read in every theme. Force-close and reopen: the last theme is still set.
9. [ ] **System theme.** Turn on the phone's dark mode and set the app to follow the system (if offered). The app switches with the phone.
10. [ ] **Bottom sheet.** Settings, Install help. A sheet slides up from the bottom. Close it with the Close button, then reopen it and close it with a swipe down.
11. [ ] **Back gesture.** With the sheet open, do the system back gesture or press Back. The sheet closes and you stay on Settings. Back again moves to the previous tab or screen. From the Library, Back leaves the app normally.
12. [ ] **Touch comfort.** Every tab and button is easy to hit with one thumb. Text size follows the phone's Font size setting in Android Settings (turn it up one notch and check nothing is cut off).

## B. iPhone (Safari)

Device and iOS version: ______________________

1. [ ] **Open the link** in Safari (not inside another app). The Library screen shows within about 3 seconds. No login or ad.
2. [ ] **Add to Home Screen.** Tap Share, Add to Home Screen, Add. An icon named "InkQuiet" appears, and the icon looks right (the iPhone does not add a black border or crop it).
3. [ ] **Launch from the icon.** It opens full screen with no Safari bars.
4. [ ] **Offline launch.** Open the app once, then swipe it away from the app switcher. Turn on airplane mode. Launch from the icon. The Library screen appears in about 1 second. (If it shows a blank or error page, mark FAIL. Also note whether you waited 10 seconds after the very first open before going offline.)
5. [ ] **Tabs offline.** Still in airplane mode, tap all four tabs. Each opens, and the active tab is highlighted.
6. [ ] **Safe areas.** The title does not sit under the notch or Dynamic Island. The tab bar is clear of the home bar at the bottom. Rotate to landscape: nothing hides behind the notch.
7. [ ] **Status bar.** The clock and battery are readable in Light and in Dark themes (dark text on light pages, light text on dark pages).
8. [ ] **Theme.** Settings, Theme: choose Dark, Sepia, Black, then Light. Each changes the whole screen. Force-close and reopen: the last theme is still set.
9. [ ] **Bottom sheet.** Settings, Install help opens a sheet from the bottom. Close it with the Close button, then reopen it and close it with a swipe down.
10. [ ] **Back gesture.** With the sheet open, swipe in from the left edge. The sheet closes and you stay on Settings. The app never exits or reloads by accident.
11. [ ] **Keyboard and zoom.** Tap any text field (search, if present). The page does not zoom in on its own and nothing jumps.
12. [ ] **Dynamic Type.** Settings (iPhone), Display, Text Size: raise it one notch. Text in the app grows or stays readable and nothing is cut off.

## C. Result

| Platform | Passed | Failed | Notes |
|---|---|---|---|
| Android | __ / 12 | __ | |
| iPhone | __ / 12 | __ | |

**Phase 0 gate** (install on both and open offline: A2, A4, B2, B4): [ ] PASS  [ ] FAIL

Send the filled-in sheet and any screenshots to Casey. Items 4 on each platform decide the gate; the rest feed the bug list.

*Later phases add their own sheets here (`phase-1.md`, and so on). The 2-hour locked-screen audio test is a Phase 3 gate and is not part of this sheet.*
