const caseEase = [0.4, 0, 0.2, 1] as const;

export const caseMotion = {
  cover: { duration: 0.72, ease: caseEase },
  content: { duration: 0.45, delay: 0.22, ease: caseEase },
  pendingReveal: { duration: 0.28, delay: 0.16, ease: caseEase },
  pendingPulse: { duration: 1.8, delay: 0.44, repeat: 1, ease: 'easeInOut' },
} as const;

export const pageMotion = {
  duration: 0.56,
  ease: caseEase,
} as const;
