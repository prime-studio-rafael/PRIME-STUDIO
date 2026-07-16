import { createHash } from 'node:crypto';

export function createGenerationProfile({ promptVersion, model, requestedAspectRatio, effectiveAspectRatio, resolution }) {
  const profile = {
    promptVersion,
    model,
    requestedAspectRatio,
    effectiveAspectRatio,
    resolution,
  };

  return Object.freeze({
    ...profile,
    configurationId: createHash('sha256')
      .update(JSON.stringify(profile))
      .digest('hex')
      .slice(0, 12),
  });
}

export function dimensionsOrNull(dimensions) {
  return {
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
  };
}

export function imageValidationMetadata(image) {
  const inspection = image?.inspection;
  const validation = image?.validation;
  return {
    status: validation?.valid ? 'valid' : 'invalid',
    quality: validation?.quality ?? null,
    warnings: validation?.warnings?.map(({ code, message }) => ({ code, message })) ?? [],
    aspectRatio: inspection?.aspectRatio ?? null,
    aspectRatioLabel: inspection?.aspectRatioLabel ?? null,
    orientation: inspection?.orientation ?? null,
    sizeBytes: inspection?.sizeBytes ?? image?.buffer?.length ?? null,
    originalExtension: validation?.extension ?? null,
    realFormat: inspection?.format ?? null,
    realMimeType: inspection?.mimeType ?? null,
    extensionMatches: validation?.extensionMatches ?? null,
    mimeMatches: validation?.mimeMatches ?? null,
    integrityValid: inspection?.integrity?.valid ?? false,
  };
}
