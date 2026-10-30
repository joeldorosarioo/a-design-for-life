import { motionTokens } from './tokens';

type InteractionKind = 'button' | 'menu' | 'toast';
type Target = Readonly<{ y: number; opacity: number }>;

type InteractionMotion = Readonly<{
  initial: Target;
  animate: Target;
  exit: Target;
  whileHover: Target;
  whileTap: Target;
  transition: {
    duration: number;
    ease: typeof motionTokens.easing.standard;
  };
}>;

const visible = { y: 0, opacity: 1 } as const;
const resting = {
  initial: visible,
  animate: visible,
  whileHover: visible,
  whileTap: visible,
};
const presets: Record<InteractionKind, InteractionMotion> = {
  button: {
    ...resting,
    exit: visible,
    whileHover: { y: -motionTokens.distance.feedback, opacity: 1 },
    transition: { duration: motionTokens.duration.feedback, ease: motionTokens.easing.standard },
  },
  menu: {
    ...resting,
    exit: { y: motionTokens.distance.dismiss, opacity: 0 },
    transition: { duration: motionTokens.duration.feedback, ease: motionTokens.easing.standard },
  },
  toast: {
    ...resting,
    exit: { y: motionTokens.distance.dismiss, opacity: 0 },
    transition: { duration: motionTokens.duration.feedback, ease: motionTokens.easing.standard },
  },
};

/** Initial content stays visible on both server and first client render. */
export function resolveInteractionMotion({
  kind,
  reducedMotion,
}: {
  kind: InteractionKind;
  reducedMotion: boolean;
}): InteractionMotion {
  const preset = presets[kind];
  if (!reducedMotion) return preset;
  return {
    ...resting,
    exit: { y: 0, opacity: preset.exit.opacity },
    transition: { duration: motionTokens.duration.reduced, ease: motionTokens.easing.standard },
  };
}
