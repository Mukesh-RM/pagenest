/**
 * Every performance threshold PageNest QA enforces lives in this one file. Change a number here, nowhere else.
 * Source: blueprint section 3 principles ("every action responds within 100 ms; screens never block on heavy work")
 * and section 16 (performance targets). Where the blueprint gives no number, the choice is marked "QA choice".
 * A build that misses any of these fails QA (non-zero exit code).
 */
export const BUDGETS = {
  lighthouse: {
    /** Blueprint 19 asks for PWA and accessibility; the "no lag, ever" rule adds performance. Minimum score, 0 to 100. */
    minScore: { pwa: 90, accessibility: 90, performance: 90 },
  },

  /** QA choice. Blueprint 16 allows 3 MB for the whole shell; the first-load JavaScript must stay far below that. */
  initialJs: {
    /** Gzip size (level 9) of all JavaScript fetched by a cold first load, in KiB. */
    maxGzipKiB: 200,
  },

  /** Blueprint 3: "Every action responds within 100 ms". Measured from pointerdown to the first painted frame showing the change. */
  tap: {
    p95Ms: 100,
    samples: 24,
    /** Emulates a mid-range phone (blueprint 16 targets mid-range hardware). 1 = no throttling. */
    cpuThrottle: 4,
  },

  /** QA choice: long tasks (PerformanceObserver "longtask", over 50 ms by definition) block input. */
  jank: {
    /** No main-thread task may reach this length while scrolling, loading or filtering. */
    maxLongTaskMs: 100,
    /** Fling scroll: share of frames slower than 2 vsyncs (33.4 ms), i.e. visibly dropped. */
    maxDroppedFrameRatio: 0.05,
    /** Fling scroll: the 95th percentile frame time (60 fps = 16.7 ms). */
    p95FrameMs: 33.4,
    /** Fling scroll: no single frame slower than this. */
    maxFrameMs: 100,
    scrollSeconds: 2.5,
    scrollPxPerSecond: 3000,
  },

  /** Seeded libraries. Blueprint 16: "Library of 5,000 books: 60 fps scrolling". Brief: at least 1,000 books. */
  library: {
    sizeForOpenAndSearch: 1000,
    sizeForScroll: 5000,
    /** Time from reload to the first book card visible (blueprint 16: later launches under 1 s; QA allows +1 s with 1,000 books). */
    openMs: 2000,
    /** Typing in search or tapping a filter chip to the list showing the result (blueprint 3: 100 ms). */
    searchMs: 100,
    filterMs: 100,
  },

  /**
   * Product excellence gates (Mukeshh's bar, /workspace/pagenest-excellence-bar.txt), run on every screen.
   * Taps under 100 ms and 60 fps scrolling are the `tap` and `jank` budgets above.
   */
  excellence: {
    /** Every screen the app has, with its route. Lighthouse audits each one. */
    screens: [
      { name: 'Library', path: '/' },
      { name: 'Collections', path: '/collections' },
      { name: 'Stats', path: '/stats' },
      { name: 'Settings', path: '/settings' },
    ],
    /** "AA contrast in all five themes": blueprint 5.2 lists Light, Sepia, Dark, Black and Custom. WCAG AA text contrast. */
    themes: ['Light', 'Sepia', 'Dark', 'Black', 'Custom'],
    minContrast: 4.5,
    /** "Works at 200% text size": the root font size is set to this percentage (what the browser font-size setting does). */
    textScalePercent: 200,
    /** Phone widths: small Android and large iPhone. */
    viewportWidths: [360, 430],
    viewportHeight: 800,
    /** Smallest touch target, in CSS px (blueprint 5.8; the bar says 44). */
    minTargetPx: 44,
    /** Cumulative Layout Shift ("no layout shift"), Google's "good" limit. */
    maxCls: 0.1,
    /** With prefers-reduced-motion: reduce, no transition or animation may run longer than this. */
    reducedMotionMaxMs: 50,
  },
} as const;
