import { AppError } from '../utils/errors.js';

const REVIEW_STATUSES = new Set(['pending', 'approved', 'rejected']);

export function createResultService({ storage, templateService, brandingService } = {}) {
  async function list() {
    const results = await Promise.all((await storage.listEntries()).map((entry) => normalize(entry, templateService)));
    return results.sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt));
  }
  async function get(id) { return normalize(await storage.findById(id), templateService); }
  async function setReviewStatus(id, reviewStatus) {
    if (!REVIEW_STATUSES.has(reviewStatus)) throw new AppError('INVALID_REVIEW_STATUS', 'Use pending, approved ou rejected.', { status: 400 });
    return normalize(await storage.updateMetadata(id, (metadata) => ({ ...metadata, reviewStatus })), templateService);
  }
  async function remove(id) { await storage.delete(id); return { deleted: true, id }; }
  async function listApprovedAssets() {
    const approved = (await list()).filter((result) => result.reviewStatus === 'approved');
    if (!approved.length) throw new AppError('NO_APPROVED_RESULTS', 'Nenhum resultado aprovado para baixar.', { status: 404 });
    let brandingEnabled = false;
    if (brandingService) {
      try { brandingEnabled = Boolean((await brandingService.getState()).config.enabled); } catch { brandingEnabled = false; }
    }
    return Promise.all(approved.map(async (result) => {
      const assetType = brandingEnabled && result.assets.branded ? 'branded' : 'result';
      return { id: result.id, ...(await storage.readAsset(result.id, assetType)) };
    }));
  }
  return Object.freeze({ list, get, readAsset: storage.readAsset, setReviewStatus, delete: remove, listApprovedAssets });
}

async function normalize(entry, templateService) {
  const metadata = entry.metadata || {};
  const templateId = metadata.inputTemplateId ?? metadata.templateId ?? null;
  let currentTemplate = null;
  if (templateId && !entry.assets.template && templateService?.list) {
    try { currentTemplate = (await templateService.list()).find((template) => template.id === templateId) || null; } catch { currentTemplate = null; }
  }
  const compatibilityWarnings = [];
  if (!entry.assets.template) compatibilityWarnings.push('HISTORICAL_TEMPLATE_UNAVAILABLE');
  if (!entry.assets.garment) compatibilityWarnings.push('HISTORICAL_GARMENT_UNAVAILABLE');
  if (currentTemplate) compatibilityWarnings.push('CURRENT_TEMPLATE_NOT_HISTORICAL_SNAPSHOT');
  return {
    id: metadata.id, createdAt: metadata.createdAt ?? null,
    reviewStatus: REVIEW_STATUSES.has(metadata.reviewStatus) ? metadata.reviewStatus : 'pending',
    generationStatus: metadata.status ?? null, templateId,
    templateLabel: metadata.inputTemplateLabel ?? metadata.templateLabel ?? currentTemplate?.label ?? null,
    model: metadata.model ?? metadata.providerModel ?? metadata.modelId ?? null,
    promptVersion: metadata.promptVersion ?? null, configurationId: metadata.configurationId ?? null,
    effectiveAspectRatio: metadata.effectiveAspectRatio ?? metadata.aspectRatio ?? null,
    resolution: metadata.resolution ?? null, outputMime: metadata.outputMime ?? metadata.resultMime ?? null,
    outputDimensions: metadata.outputDimensions ?? null, durationMs: finiteOrNull(metadata.durationMs),
    costUsd: finiteOrNull(metadata.costUsd), providerRequestId: metadata.providerRequestId ?? metadata.requestId ?? null,
    logoApplied: Boolean(metadata.logoApplied),
    logoFileName: metadata.logoFileName ?? null,
    logoMime: metadata.logoMime ?? null,
    logoDimensions: metadata.logoDimensions ?? null,
    logoPosition: metadata.logoPosition ?? null,
    logoScale: finiteOrNull(metadata.logoScale),
    logoMargin: finiteOrNull(metadata.logoMargin),
    brandingStatus: metadata.brandingStatus ?? 'disabled',
    brandingError: metadata.brandingError ?? null,
    templateCategory: metadata.templateCategory ?? null,
    inputTemplatePrompt: metadata.inputTemplatePrompt ?? null,
    inputTemplateNegativePrompt: metadata.inputTemplateNegativePrompt ?? null,
    additionalInstruction: metadata.additionalInstruction ?? null,
    provider: metadata.provider ?? null,
    batchId: metadata.batchId ?? null,
    batchItemId: metadata.batchItemId ?? null,
    // origin nunca é uma segunda fonte de verdade gravada em disco — é derivado aqui, na leitura,
    // a partir de batchId (já garantido pelo generationExecutor: um Resultado só tem batchId
    // quando veio de um item de lote). metadata.origin só é respeitado se já vier explicitamente
    // válido (defensivo, para nunca quebrar caso um Resultado futuro venha a gravá-lo).
    origin: metadata.origin === 'batch' || metadata.origin === 'individual'
      ? metadata.origin
      : metadata.batchId ? 'batch' : 'individual',
    assets: {
      result: `/api/results/${encodeURIComponent(metadata.id)}/assets/result`,
      branded: entry.assets.branded ? `/api/results/${encodeURIComponent(metadata.id)}/assets/branded` : null,
      template: entry.assets.template ? `/api/results/${encodeURIComponent(metadata.id)}/assets/template` : null,
      garment: entry.assets.garment ? `/api/results/${encodeURIComponent(metadata.id)}/assets/garment` : null,
      currentTemplate: currentTemplate?.publicUrl ?? null,
    },
    compatibilityWarnings, metadata,
  };
}
function finiteOrNull(value) { return Number.isFinite(value) ? value : null; }
function timestamp(value) { const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : 0; }
