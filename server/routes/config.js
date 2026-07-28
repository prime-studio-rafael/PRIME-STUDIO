import { Router } from 'express';
import { generationConfig } from '../config/generationConfig.js';
import { listModels } from '../catalogs/models.js';

export function createConfigRouter({ keyResolver, aiSettingsService }) {
  const router = Router();
  router.get('/', async (_request, response, next) => {
    try {
      const [keyStatus, dashboardSettings] = await Promise.all([
        keyResolver.getStatus(),
        aiSettingsService?.getDashboardSettings?.() || { usdToBrlRate: 5.5 },
      ]);
    response.json({
      keyConfigured: keyStatus.configured,
      model: { ...listModels()[0], name: listModels()[0].label, technicalId: listModels()[0].providerModel },
      image: {
        resolution: generationConfig.resolution,
        aspectRatio: generationConfig.effectiveAspectRatio,
        aspectRatioStatus: generationConfig.aspectRatioActivation.status,
        aspectRatioBlockingReason: generationConfig.aspectRatioActivation.reason,
      },
      fixedGeneration: {
        resolution: generationConfig.resolution,
        aspectRatio: generationConfig.effectiveAspectRatio,
        effectiveAspectRatio: generationConfig.effectiveAspectRatio,
        requestedAspectRatio: generationConfig.requestedAspectRatio,
        aspectRatioCapabilityConfirmed: generationConfig.aspectRatioCapabilityConfirmed,
        fallbackAspectRatio: generationConfig.fallbackAspectRatio,
        aspectRatioActivation: generationConfig.aspectRatioActivation,
      },
      clothingScope: 'Roupas superiores',
      imagePolicy: generationConfig.imagePolicy,
      maxFileSizeBytes: generationConfig.imagePolicy.maxFileSizeBytes,
      allowedMimeTypes: generationConfig.imagePolicy.allowedMimeTypes,
      dashboardSettings,
    });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
