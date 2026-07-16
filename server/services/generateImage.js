import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { generationConfig } from '../config/generationConfig.js';
import { getModelById } from '../catalogs/models.js';
import { getTemplateById } from '../catalogs/templates.js';
import { buildUpperGarmentPrompt, UPPER_GARMENT_PROMPT_VERSION } from '../prompts/upperGarmentPrompt.js';
import { AppError } from '../utils/errors.js';
import { bufferToDataUrl } from '../utils/imageEncoding.js';
import { validateImageBuffer, validateUploadedImage } from '../utils/fileValidation.js';
import { parseOpenRouterImageResponse } from '../providers/openrouter/openrouterResponse.js';
import { createGenerationProfile, dimensionsOrNull, imageValidationMetadata } from '../utils/generationMetadata.js';

export function createGenerationService({
  openRouterClient,
  resultStorage,
  templateCatalog = { getTemplateById },
  config = generationConfig,
  logger = console,
  readFileImpl = readFile,
  now = () => Date.now(),
  uuid = randomUUID,
} = {}) {
  let active = false;

  return {
    isBusy() {
      return active;
    },

    async generate({ templateId, modelId, confirmPaid, garmentFile }) {
      if (active) {
        throw new AppError('GENERATION_IN_PROGRESS', 'Já existe uma geração em andamento.', { status: 409 });
      }

      active = true;
      const startedAt = now();
      const generationId = uuid();

      try {
        if (!confirmPaid) {
          throw new AppError('PAID_CONFIRMATION_REQUIRED', 'Confirme o uso de créditos antes de gerar.', { status: 400 });
        }

        const model = getModelById(modelId);
        if (!model) {
          throw new AppError('INVALID_MODEL', 'O modelo selecionado não está disponível.', { status: 400 });
        }

        const template = templateCatalog.getTemplateById(templateId);
        if (!template) {
          throw new AppError('INVALID_TEMPLATE', 'O template selecionado não existe.', { status: 400 });
        }

        const garment = validateUploadedImage(garmentFile, config);
        const templateBuffer = await readFileImpl(template.filePath);
        const templateImage = validateImageBuffer(templateBuffer, {
          fieldLabel: 'Template',
          fileName: template.filename,
          expectedMimeType: template.expectedMimeType,
          role: 'template',
          declaredAspectRatio: template.declaredAspectRatio,
          policy: config.imagePolicy,
        });
        const prompt = buildUpperGarmentPrompt();
        const generationProfile = createGenerationProfile({
          promptVersion: UPPER_GARMENT_PROMPT_VERSION,
          model: model.providerModel,
          requestedAspectRatio: config.requestedAspectRatio,
          effectiveAspectRatio: config.effectiveAspectRatio || config.aspectRatio,
          resolution: config.resolution,
        });

        const providerResponse = await openRouterClient.generate({
          model: model.providerModel,
          prompt,
          resolution: config.resolution,
          aspectRatio: config.effectiveAspectRatio || config.aspectRatio,
          inputReferences: [
            bufferToDataUrl(templateImage.buffer, templateImage.mimeType),
            bufferToDataUrl(garment.buffer, garment.mimeType),
          ],
        });

        const generated = parseOpenRouterImageResponse(providerResponse);
        const completedAt = now();
        const durationMs = completedAt - startedAt;
        const costUsd = typeof generated.usage.cost === 'number' ? generated.usage.cost : null;
        const downloadFilename = `prime-ia-studio-result.${extensionFor(generated.mimeType)}`;
        const metadata = {
          id: generationId,
          createdAt: new Date(completedAt).toISOString(),
          ...generationProfile,
          modelId: model.id,
          inputTemplateId: templateId,
          inputTemplateMime: templateImage.mimeType,
          inputTemplateDimensions: dimensionsOrNull(templateImage.dimensions),
          inputTemplateValidation: imageValidationMetadata(templateImage),
          inputGarmentMime: garment.mimeType,
          inputGarmentDimensions: dimensionsOrNull(garment.dimensions),
          inputGarmentValidation: imageValidationMetadata(garment),
          aspectRatioActivation: {
            status: config.aspectRatioActivation?.status || 'blocked',
            reason: config.aspectRatioActivation?.reason || null,
          },
          outputMime: generated.mimeType,
          outputDimensions: dimensionsOrNull(generated.dimensions),
          durationMs,
          costUsd,
          providerRequestId: generated.requestId,
          status: 'success',
        };

        let localSave = { saved: false, metadataSaved: false, warning: 'A imagem foi gerada, mas não pôde ser salva localmente.' };
        try {
          localSave = await resultStorage.save({
            generationId,
            buffer: generated.buffer,
            mimeType: generated.mimeType,
            metadata,
          });
        } catch (error) {
          logger.error?.('[storage]', error.code || error.message);
        }

        return {
          generationId,
          image: {
            dataUrl: bufferToDataUrl(generated.buffer, generated.mimeType),
            mimeType: generated.mimeType,
            downloadFilename,
          },
          metrics: { costUsd, durationMs },
          requestId: generated.requestId,
          localSave,
          model: { id: model.id, label: model.label },
        };
      } finally {
        active = false;
      }
    },
  };
}

function extensionFor(mimeType) {
  return mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1] || 'png';
}
