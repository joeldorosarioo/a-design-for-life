const restrictedFeature = 'ch-ua-high-entropy-values';
type Policy = { features?: unknown; allowsFeature?: unknown };

/** A false answer for an unknown feature is not evidence that a browser enforces it. */
export function hasRestrictedDevicePolicy(document: Document): boolean {
  try {
    const policy = (document as Document & { featurePolicy?: Policy }).featurePolicy;
    if (
      !policy ||
      typeof policy.features !== 'function' ||
      typeof policy.allowsFeature !== 'function'
    )
      return false;
    const features: unknown = policy.features();
    return (
      Array.isArray(features) &&
      features.includes(restrictedFeature) &&
      policy.allowsFeature(restrictedFeature) === false
    );
  } catch {
    return false;
  }
}
