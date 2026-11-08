/** Interaction feedback only; no entrance, scroll or layout animation. */
export const motionTokens = {
  duration: { feedback: 0.18, reduced: 0.15 },
  easing: { standard: [0.4, 0, 0.2, 1] as const },
  distance: { feedback: 4, dismiss: 8 },
} as const;
