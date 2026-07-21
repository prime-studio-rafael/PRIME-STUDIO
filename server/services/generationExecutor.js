import { randomUUID } from 'node:crypto';
import { generationConfig } from '../config/generationConfig.js';
import { getModelById } from '../catalogs/models.js';
import { buildGenerationPrompt } from '../prompts/buildGenerationPrompt.js';
import { GLOBAL_GENERATION_RULES } from '../prompts/globalGenerationRules.js';
import { AppError } from '../utils/errors.js';
import { bufferToDataUrl } from '../utils/imageEncoding.js';
import { validateImageBuffer, validateUploadedImage } from '../utils/fileValidation.js';
import { parseOpenRouterImageResponse } from '../providers/openrouter/openrouterResponse.js';
import { createGenerationProfile, dimensionsOrNull, imageValidationMetadata } from '../utils/generationMetadata.js';
import { applyLogoOverlay } from './logoOverlay.js';

const DISABLED_BRANDING_METADATA = Object.freeze({
  logoApplied: false, logoFileName: null, logoMime: null, logoDimensions: null,
  logoPosition: null, logoScale: null, logoMargin: null,
  brandingStatus: 'disabled', brandingError: null,
  originalResultAsset: 'result', brandedResultAsset: null,
});

export function createGenerationExecutor({ openRouterClient, resultStorage, templateService, brandingService, config = generationConfig, logger = console, now = () => Date.now(), uuid = randomUUID } = {}) {
  async function execute({ templateId, modelId, garmentFile, templateSnapshot, additionalInstruction, batchContext } = {}) {
    const garment = validateUploadedImage(garmentFile, config);
    const template = templateSnapshot ? validateSnapshot(templateSnapshot, config) : await resolveTemplate(templateId);
    if (template.provider && template.provider !== 'openrouter') {
      throw new AppError('UNSUPPORTED_PROVIDER', 'Este Template está configurado para um provedor de IA não suportado.', { status: 422 });
    }
    const model = getModelById(template.modelId || modelId || config.modelId);
    if (!model) throw new AppError('INVALID_MODEL', 'O modelo selecionado não está disponível.', { status: 400 });
    const generationId = uuid();
    const startedAt = now();
    const effectiveAspectRatio = template.generationAspectRatio || config.effectiveAspectRatio || config.aspectRatio;
    const effectiveResolution = template.resolution || config.resolution;
    const prompt = buildGenerationPrompt({
      templatePrompt: template.prompt,
      globalRules: GLOBAL_GENERATION_RULES,
      negativePrompt: template.negativePrompt,
      additionalInstruction,
    });
    const profile = createGenerationProfile({ promptVersion: template.promptVersion, model: model.providerModel, requestedAspectRatio: config.requestedAspectRatio, effectiveAspectRatio, resolution: effectiveResolution });
    const providerResponse = await openRouterClient.generate({
      model: model.providerModel,
      prompt,
      resolution: effectiveResolution,
      aspectRatio: effectiveAspectRatio,
      inputReferences: [bufferToDataUrl(template.image.buffer, template.image.mimeType), bufferToDataUrl(garment.buffer, garment.mimeType)],
    });
    const generated = parseOpenRouterImageResponse(providerResponse);
    const completedAt = now();
    const durationMs = completedAt - startedAt;
    const costUsd = typeof generated.usage.cost === 'number' ? generated.usage.cost : null;
    const { branded, brandingMetadata } = await applyBrandingIfEnabled({ brandingService, generated, logger });
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
      templateCategory: template.category ?? null,
      inputTemplatePrompt: template.prompt ?? null,
      inputTemplateNegativePrompt: template.negativePrompt ?? null,
      additionalInstruction: additionalInstruction?.trim() || null,
      provider: template.provider ?? null,
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
      ...brandingMetadata,
      ...(batchContext ? { batchId: batchContext.batchId, batchItemId: batchContext.batchItemId } : {}),
    };
    let localSave = { saved: false, metadataSaved: false, warning: 'A imagem foi gerada, mas não pôde ser salva localmente.' };
    try {
      localSave = await resultStorage.save({ generationId, buffer: generated.buffer, mimeType: generated.mimeType, metadata, template: { buffer: template.image.buffer, mimeType: template.image.mimeType }, garment: { buffer: garment.buffer, mimeType: garment.mimeType }, branded });
    } catch (error) { logger.error?.('[storage]', error.code || error.message); }
    return { generationId, image: { dataUrl: bufferToDataUrl(generated.buffer, generated.mimeType), mimeType: generated.mimeType, downloadFilename: `prime-ia-studio-result.${extensionFor(generated.mimeType)}` }, metrics: { costUsd, durationMs }, requestId: generated.requestId, localSave, model: { id: model.id, label: model.label }, metadata };
  }

  async function resolveTemplate(templateId) {
    if (!templateService?.getForGeneration) throw new AppError('TEMPLATE_SERVICE_UNAVAILABLE', 'O catálogo local de templates não está disponível.', { status: 500 });
    const { publicTemplate, image } = await templateService.getForGeneration(templateId);
    if (!publicTemplate.prompt?.trim()) {
      throw new AppError('TEMPLATE_PROFILE_INCOMPLETE', 'Este Template ainda não tem um perfil de geração configurado. Configure o prompt antes de gerar.', { status: 422 });
    }
    return {
      id: publicTemplate.id, label: publicTemplate.label, image, category: publicTemplate.category ?? null,
      prompt: publicTemplate.prompt, negativePrompt: publicTemplate.negativePrompt ?? null,
      provider: publicTemplate.provider ?? null, modelId: publicTemplate.modelId ?? null,
      generationAspectRatio: publicTemplate.generationAspectRatio ?? null, resolution: publicTemplate.resolution ?? null,
      promptVersion: publicTemplate.promptVersion,
    };
  }
  return Object.freeze({ execute });
}

// Caminho de lote: nenhum templateSnapshot hoje carrega prompt/negativePrompt/provider/modelId/
// generationAspectRatio/resolution/promptVersion (a Fase 3 é quem vai congelar o perfil completo
// no snapshot). Sem evidência persistida de que o Template original tinha um perfil configurado,
// não há fallback seguro — todo snapshot incompleto é rejeitado antes de qualquer prompt ser
// montado e antes de qualquer chamada ao provedor, sem tentar completá-lo com o Template atual.
function validateSnapshot(snapshot, config) {
  if (!snapshot.prompt?.trim()) {
    throw new AppError('BATCH_TEMPLATE_PROFILE_INCOMPLETE', 'Este lote foi criado antes dos perfis de geração por Template. Para evitar uma geração incorreta, cancele este lote e crie um novo após configurar o Template.', { status: 422 });
  }
  const image = validateImageBuffer(snapshot.buffer, { expectedMimeType: snapshot.mimeType, maxBytes: config.maxFileSizeBytes, fieldLabel: 'Snapshot do template', fileName: snapshot.fileName || 'template', role: 'template', policy: config.imagePolicy });
  return {
    id: snapshot.id, label: snapshot.label, image, category: snapshot.category ?? null,
    prompt: snapshot.prompt, negativePrompt: snapshot.negativePrompt ?? null,
    provider: snapshot.provider ?? null, modelId: snapshot.modelId ?? null,
    generationAspectRatio: snapshot.generationAspectRatio ?? null, resolution: snapshot.resolution ?? null,
    promptVersion: snapshot.promptVersion ?? null,
  };
}
function extensionFor(mimeType) { return mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1] || 'png'; }

// Aplica a logo (overlay tradicional, sem IA) somente se Branding estiver ligado e houver logo aprovada.
// Nenhuma chamada ao `sharp` acontece quando Branding está desligado. Falha aqui nunca invalida a geração paga:
// o resultado original já foi gerado e será salvo normalmente; só a variante branded fica ausente.
async function applyBrandingIfEnabled({ brandingService, generated, logger }) {
  if (!brandingService) return { branded: null, brandingMetadata: DISABLED_BRANDING_METADATA };
  let active = null;
  try {
    active = await brandingService.getActiveBranding();
  } catch (error) {
    logger.error?.('[branding]', error?.code || error?.message);
    return { branded: null, brandingMetadata: DISABLED_BRANDING_METADATA };
  }
  if (!active) return { branded: null, brandingMetadata: DISABLED_BRANDING_METADATA };

  try {
    const overlay = await applyLogoOverlay({ resultBuffer: generated.buffer, resultMimeType: generated.mimeType, logoBuffer: active.buffer });
    return {
      branded: { buffer: overlay.buffer, mimeType: overlay.mimeType },
      brandingMetadata: {
        logoApplied: true,
        logoFileName: active.fileName,
        logoMime: active.mimeType,
        logoDimensions: overlay.logoDimensions,
        logoPosition: overlay.position,
        logoScale: overlay.scale,
        logoMargin: overlay.margin,
        brandingStatus: 'applied',
        brandingError: null,
        originalResultAsset: 'result',
        brandedResultAsset: 'branded',
      },
    };
  } catch (error) {
    logger.error?.('[branding]', error?.code || error?.message);
    return {
      branded: null,
      brandingMetadata: {
        logoApplied: false,
        logoFileName: active.fileName,
        logoMime: active.mimeType,
        logoDimensions: null,
        logoPosition: null,
        logoScale: null,
        logoMargin: null,
        brandingStatus: 'failed',
        brandingError: { code: error?.code || 'BRANDING_OVERLAY_FAILED', message: 'Não foi possível aplicar a logo a este resultado.' },
        originalResultAsset: 'result',
        brandedResultAsset: null,
      },
    };
  }
}
