import { AppError } from '../utils/errors.js';

const REVIEW_STATUSES = new Set(['pending', 'approved', 'rejected']);

export function createResultService({ storage, templateService } = {}) {
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
    return Promise.all(approved.map(async (result) => ({ id: result.id, ...(await storage.readAsset(result.id, 'result')) })));
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
    assets: {
      result: `/api/results/${encodeURIComponent(metadata.id)}/assets/result`,
      template: entry.assets.template ? `/api/results/${encodeURIComponent(metadata.id)}/assets/template` : null,
      garment: entry.assets.garment ? `/api/results/${encodeURIComponent(metadata.id)}/assets/garment` : null,
      currentTemplate: currentTemplate?.publicUrl ?? null,
    },
    compatibilityWarnings, metadata,
  };
}
function finiteOrNull(value) { return Number.isFinite(value) ? value : null; }
function timestamp(value) { const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : 0; }
