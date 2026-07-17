import { randomUUID } from 'node:crypto';
import { generationConfig } from '../config/generationConfig.js';
import { getModelById } from '../catalogs/models.js';
import { buildUpperGarmentPrompt, UPPER_GARMENT_PROMPT_VERSION } from '../prompts/upperGarmentPrompt.js';
import { AppError } from '../utils/errors.js';
import { bufferToDataUrl } from '../utils/imageEncoding.js';
import { validateImageBuffer, validateUploadedImage } from '../utils/fileValidation.js';
import { parseOpenRouterImageResponse } from '../providers/openrouter/openrouterResponse.js';
import { createGenerationProfile, dimensionsOrNull, imageValidationMetadata } from '../utils/generationMetadata.js';

export function createGenerationExecutor({ openRouterClient, resultStorage, templateService, config = generationConfig, logger = console, now = () => Date.now(), uuid = randomUUID } = {}) {
  async function execute({ templateId, modelId, garmentFile, templateSnapshot, batchContext } = {}) {
    const model = getModelById(modelId);
    if (!model) throw new AppError('INVALID_MODEL', 'O modelo selecionado não está disponível.', { status: 400 });
    const garment = validateUploadedImage(garmentFile, config);
    const template = templateSnapshot ? validateSnapshot(templateSnapshot, config) : await resolveTemplate(templateId);
    const generationId = uuid();
    const startedAt = now();
    const profile = createGenerationProfile({ promptVersion: UPPER_GARMENT_PROMPT_VERSION, model: model.providerModel, requestedAspectRatio: config.requestedAspectRatio, effectiveAspectRatio: config.effectiveAspectRatio || config.aspectRatio, resolution: config.resolution });
    const providerResponse = await openRouterClient.generate({
      model: model.providerModel,
      prompt: buildUpperGarmentPrompt(),
      resolution: config.resolution,
      aspectRatio: config.effectiveAspectRatio || config.aspectRatio,
      inputReferences: [bufferToDataUrl(template.image.buffer, template.image.mimeType), bufferToDataUrl(garment.buffer, garment.mimeType)],
    });
    const generated = parseOpenRouterImageResponse(providerResponse);
    const completedAt = now();
    const durationMs = completedAt - startedAt;
    const costUsd = typeof generated.usage.cost === 'number' ? generated.usage.cost : null;
    const metadata = {
      id: generationId,
      createdAt: new Date(completedAt).toISOString(),
      ...profile,
      modelId: model.id,
      inputTemplateId: template.id,
      inputTemplateLabel: template.label,
      inputTemplateMime: template.image.mimeType,
      inputTemplateDimensions: dimensionsOrNull(template.image.dimensions),
      inputTemplateValidation: imageValidationMetadata(template.image),
      inputGarmentMime: garment.mimeType,
      inputGarmentDimensions: dimensionsOrNull(garment.dimensions),
      inputGarmentValidation: imageValidationMetadata(garment),
      aspectRatioActivation: { status: config.aspectRatioActivation?.status || 'blocked', reason: config.aspectRatioActivation?.reason || null },
      outputMime: generated.mimeType,
      outputDimensions: dimensionsOrNull(generated.dimensions),
      durationMs,
      costUsd,
      providerRequestId: generated.requestId,
      status: 'success',
      ...(batchContext ? { batchId: batchContext.batchId, batchItemId: batchContext.batchItemId } : {}),
    };
    let localSave = { saved: false, metadataSaved: false, warning: 'A imagem foi gerada, mas não pôde ser salva localmente.' };
    try {
      localSave = await resultStorage.save({ generationId, buffer: generated.buffer, mimeType: generated.mimeType, metadata, template: { buffer: template.image.buffer, mimeType: template.image.mimeType }, garment: { buffer: garment.buffer, mimeType: garment.mimeType } });
    } catch (error) { logger.error?.('[storage]', error.code || error.message); }
    return { generationId, image: { dataUrl: bufferToDataUrl(generated.buffer, generated.mimeType), mimeType: generated.mimeType, downloadFilename: `prime-ia-studio-result.${extensionFor(generated.mimeType)}` }, metrics: { costUsd, durationMs }, requestId: generated.requestId, localSave, model: { id: model.id, label: model.label }, metadata };
  }

  async function resolveTemplate(templateId) {
    if (!templateService?.getForGeneration) throw new AppError('TEMPLATE_SERVICE_UNAVAILABLE', 'O catálogo local de templates não está disponível.', { status: 500 });
    const { publicTemplate, image } = await templateService.getForGeneration(templateId);
    return { id: publicTemplate.id, label: publicTemplate.label, image };
  }
  return Object.freeze({ execute });
}

function validateSnapshot(snapshot, config) {
  const image = validateImageBuffer(snapshot.buffer, { expectedMimeType: snapshot.mimeType, maxBytes: config.maxFileSizeBytes, fieldLabel: 'Snapshot do template', fileName: snapshot.fileName || 'template', role: 'template', policy: config.imagePolicy });
  return { id: snapshot.id, label: snapshot.label, image };
}
function extensionFor(mimeType) { return mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1] || 'png'; }
