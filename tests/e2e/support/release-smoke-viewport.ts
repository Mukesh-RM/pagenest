/** Android Chrome (Pixel-class) and iPhone WebKit profiles for pre-merge smoke. */
export const RELEASE_SMOKE_VIEWPORT = {
  chromium: { width: 412, height: 915 },
  webkit: { width: 390, height: 844 },
} as const;

export function releaseSmokeViewport(projectName: string): { width: number; height: number } {
  return projectName.includes('webkit') ? RELEASE_SMOKE_VIEWPORT.webkit : RELEASE_SMOKE_VIEWPORT.chromium;
}
