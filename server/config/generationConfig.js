import { imagePolicy } from '../../shared/imagePolicy.js';

const aspectRatioActivation = Object.freeze({
  status: 'blocked',
  reason: 'Os templates canônicos atuais medem 773×1024 (proporção real 0,755), fora da tolerância de 4:5, e a capacidade do endpoint ainda não foi confirmada sem custo.',
  requiredTemplateAspectRatio: imagePolicy.template.targetAspectRatio,
});

export const generationConfig = Object.freeze({
  modelId: 'nano-banana-lite',
  providerModel: 'google/gemini-3.1-flash-lite-image',
  resolution: '1K',
  requestedAspectRatio: '4:5',
  effectiveAspectRatio: '1:1',
  aspectRatio: '1:1',
  fallbackAspectRatio: '1:1',
  aspectRatioCapabilityConfirmed: false,
  aspectRatioActivation,
  imagePolicy,
  maxFileSizeBytes: imagePolicy.maxFileSizeBytes,
  allowedMimeTypes: imagePolicy.allowedMimeTypes,
  timeoutMs: 120_000,
  openRouterBaseUrl: 'https://openrouter.ai/api/v1',
});
