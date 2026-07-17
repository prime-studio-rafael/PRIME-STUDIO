import path from 'node:path';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { AppError } from '../utils/errors.js';
import { detectImageFormat } from '../../shared/imageInspection.js';
import { getTemplateById } from '../catalogs/templates.js';
import { applyLogoOverlay } from './logoOverlay.js';

// Prévia "Original × Com logo": reaproveita uma fotografia local já existente (o mesmo template
// seed usado na geração) em vez de criar uma imagem de demonstração nova, e reaproveita
// integralmente a composição tradicional (sem IA) já usada no pipeline real de geração.
const PREVIEW_DEMO_TEMPLATE_ID = 'model-01';

// Valores iniciais recomendados — documentados e ajustáveis conforme validação visual.
const MIN_DIMENSION = 256;
const MAX_BYTES = 10 * 1024 * 1024;
const MIN_OPAQUE_RATIO = 0.005; // abaixo disso: arte praticamente invisível ("totalmente transparente")
const MIN_TRANSPARENT_RATIO = 0.005; // abaixo disso: sem transparência real perceptível ("totalmente opaco")
const OCCUPANCY_INADEQUATE = 0.03; // bounding box da arte cobre menos que isso do canvas
const OCCUPANCY_WARNING = 0.15;
const ASPECT_RATIO_INADEQUATE = 6; // proporção largura:altura (ou inverso) acima disso
const ASPECT_RATIO_WARNING = 4;
const VISIBLE_ALPHA_THRESHOLD = 10; // acima disso, o pixel conta para o bounding box da arte
const OPAQUE_ALPHA_THRESHOLD = 250;
const TRANSPARENT_ALPHA_THRESHOLD = 5;

export function createBrandingService({ storage } = {}) {
  if (!storage) throw new TypeError('BrandingService requires storage.');

  async function getState() {
    const [config, metadata] = await Promise.all([storage.readConfig(), storage.readMetadata()]);
    return { config, pending: metadata.pending, approved: metadata.approved };
  }

  async function uploadLogo({ buffer, mimetype, originalname }) {
    assertBasics(buffer, mimetype);
    assertSignatureAndNaming(buffer, mimetype, originalname);

    let meta;
    try {
      meta = await sharp(buffer).metadata();
    } catch (error) {
      throw new AppError('BRANDING_LOGO_CORRUPTED', 'O arquivo da logo está corrompido ou não pôde ser lido.', { status: 400, cause: error });
    }
    if (!meta.width || !meta.height) {
      throw new AppError('BRANDING_LOGO_CORRUPTED', 'Não foi possível ler as dimensões da logo.', { status: 400 });
    }
    if (!meta.hasAlpha) {
      throw new AppError('BRANDING_LOGO_NO_ALPHA', 'A logo precisa ter um canal de transparência (PNG com alpha).', { status: 400 });
    }
    if (meta.width < MIN_DIMENSION || meta.height < MIN_DIMENSION) {
      throw new AppError('BRANDING_LOGO_TOO_SMALL', `A logo deve ter pelo menos ${MIN_DIMENSION}×${MIN_DIMENSION} pixels.`, { status: 400 });
    }

    const analysis = await analyzeAlpha(buffer);
    const classification = classify({ width: meta.width, height: meta.height, ...analysis });

    const pendingRecord = {
      fileName: sanitizeFileName(originalname),
      mimeType: 'image/png',
      sizeBytes: buffer.length,
      dimensions: { width: meta.width, height: meta.height },
      aspectRatio: Number((meta.width / meta.height).toFixed(4)),
      hasAlpha: true,
      opaquePixelRatio: round(analysis.opaqueRatio),
      transparentPixelRatio: round(analysis.transparentRatio),
      boundingBox: analysis.boundingBox,
      canvasOccupancyRatio: round(analysis.canvasOccupancyRatio),
      quality: classification.quality,
      errors: classification.errors,
      warnings: classification.warnings,
      uploadedAt: new Date().toISOString(),
    };

    await storage.savePendingLogo(buffer);
    const metadata = await storage.readMetadata();
    await storage.writeMetadata({ ...metadata, pending: pendingRecord });
    return pendingRecord;
  }

  async function approveLogo() {
    const metadata = await storage.readMetadata();
    if (!metadata.pending) throw new AppError('BRANDING_NO_PENDING_LOGO', 'Envie uma logo antes de aprovar.', { status: 400 });
    if (metadata.pending.quality === 'inadequate') throw new AppError('BRANDING_LOGO_INADEQUATE', 'Esta logo foi classificada como inadequada e não pode ser aprovada.', { status: 400 });
    await storage.promotePendingToApproved();
    const approved = { ...metadata.pending, approvedAt: new Date().toISOString() };
    await storage.writeMetadata({ ...metadata, approved, pending: null });
    return approved;
  }

  async function setConfig({ enabled }) {
    const metadata = await storage.readMetadata();
    if (enabled && !metadata.approved) throw new AppError('BRANDING_NOT_APPROVED', 'Aprove uma logo antes de ativar a aplicação automática.', { status: 400 });
    const current = await storage.readConfig();
    const next = { ...current, enabled: Boolean(enabled) };
    await storage.writeConfig(next);
    return next;
  }

  async function deleteLogo() {
    await storage.deleteApprovedLogo();
    const metadata = await storage.readMetadata();
    await storage.writeMetadata({ ...metadata, approved: null });
    const config = await storage.readConfig();
    await storage.writeConfig({ ...config, enabled: false });
    return { deleted: true };
  }

  async function readLogoAsset(variant = 'approved') {
    if (!['approved', 'pending'].includes(variant)) throw new AppError('BRANDING_INVALID_VARIANT', 'Variante de logo inválida.', { status: 400 });
    const buffer = variant === 'approved' ? await storage.readApprovedLogo() : await storage.readPendingLogo();
    if (!buffer) throw new AppError('BRANDING_LOGO_NOT_FOUND', 'Nenhuma logo disponível para esta variante.', { status: 404 });
    return { buffer, mimeType: 'image/png' };
  }

  async function getPreviewAsset(variant) {
    if (!['original', 'branded'].includes(variant)) {
      throw new AppError('BRANDING_INVALID_PREVIEW_VARIANT', 'Variante de prévia inválida.', { status: 400 });
    }
    const demoTemplate = getTemplateById(PREVIEW_DEMO_TEMPLATE_ID);
    if (!demoTemplate?.filePath) {
      throw new AppError('BRANDING_PREVIEW_DEMO_MISSING', 'Imagem de demonstração local não encontrada.', { status: 500 });
    }
    const demoBuffer = await readFile(demoTemplate.filePath);
    const demoMimeType = demoTemplate.expectedMimeType;
    if (variant === 'original') return { buffer: demoBuffer, mimeType: demoMimeType };

    const metadata = await storage.readMetadata();
    const logoBuffer = metadata.approved ? await storage.readApprovedLogo() : null;
    if (!metadata.approved || !logoBuffer) {
      throw new AppError('BRANDING_NO_APPROVED_LOGO', 'Nenhuma logo aprovada para gerar a prévia.', { status: 404 });
    }
    const overlay = await applyLogoOverlay({ resultBuffer: demoBuffer, resultMimeType: demoMimeType, logoBuffer });
    return { buffer: overlay.buffer, mimeType: overlay.mimeType };
  }

  // Uso interno pelo GenerationExecutor — não exposto via HTTP.
  async function getActiveBranding() {
    const config = await storage.readConfig();
    if (!config.enabled) return null;
    const buffer = await storage.readApprovedLogo();
    if (!buffer) return null;
    const metadata = await storage.readMetadata();
    return { buffer, mimeType: 'image/png', fileName: metadata.approved?.fileName || 'logo.png' };
  }

  return Object.freeze({ getState, uploadLogo, approveLogo, setConfig, deleteLogo, readLogoAsset, getPreviewAsset, getActiveBranding });
}

function assertBasics(buffer, mimetype) {
  if (!buffer || buffer.length === 0) throw new AppError('BRANDING_LOGO_EMPTY', 'A logo enviada está vazia.', { status: 400 });
  if (buffer.length > MAX_BYTES) throw new AppError('BRANDING_LOGO_TOO_LARGE', 'A logo deve ter no máximo 10 MB.', { status: 413 });
  if (!mimetype) throw new AppError('BRANDING_LOGO_MIME_MISMATCH', 'O tipo MIME da logo é obrigatório.', { status: 400 });
}

function assertSignatureAndNaming(buffer, mimetype, originalname) {
  const format = detectImageFormat(buffer);
  if (format !== 'png') throw new AppError('BRANDING_LOGO_INVALID_SIGNATURE', 'A logo precisa ser um arquivo PNG verdadeiro.', { status: 400 });
  if (mimetype !== 'image/png') throw new AppError('BRANDING_LOGO_MIME_MISMATCH', 'O tipo MIME da logo deve ser image/png.', { status: 400 });
  const extension = path.extname(originalname || '').slice(1).toLowerCase();
  if (extension !== 'png') throw new AppError('BRANDING_LOGO_EXTENSION_MISMATCH', 'A logo deve ter extensão .png.', { status: 400 });
}

async function analyzeAlpha(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const totalPixels = width * height;
  let opaqueCount = 0;
  let transparentCount = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > OPAQUE_ALPHA_THRESHOLD) opaqueCount += 1;
      if (alpha < TRANSPARENT_ALPHA_THRESHOLD) transparentCount += 1;
      if (alpha > VISIBLE_ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const hasVisibleContent = maxX >= minX && maxY >= minY;
  const boundingBox = hasVisibleContent ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } : null;
  const canvasOccupancyRatio = boundingBox ? (boundingBox.width * boundingBox.height) / totalPixels : 0;
  return {
    opaqueRatio: opaqueCount / totalPixels,
    transparentRatio: transparentCount / totalPixels,
    boundingBox,
    canvasOccupancyRatio,
  };
}

function classify({ width, height, opaqueRatio, transparentRatio, canvasOccupancyRatio }) {
  const errors = [];
  const warnings = [];

  if (opaqueRatio < MIN_OPAQUE_RATIO) errors.push(issue('LOGO_EMPTY_ART', 'A logo está praticamente sem conteúdo visível (totalmente ou quase totalmente transparente).'));
  if (transparentRatio < MIN_TRANSPARENT_RATIO) errors.push(issue('LOGO_NOT_TRANSPARENT', 'A logo não possui transparência real perceptível (praticamente totalmente opaca).'));

  if (canvasOccupancyRatio < OCCUPANCY_INADEQUATE) errors.push(issue('LOGO_TOO_SMALL_IN_CANVAS', 'A arte ocupa uma fração muito pequena do canvas da imagem.'));
  else if (canvasOccupancyRatio < OCCUPANCY_WARNING) warnings.push(issue('LOGO_SMALL_IN_CANVAS', 'A arte ocupa uma fração pequena do canvas; considere recortar o espaço vazio ao redor.'));

  const ratio = Math.max(width / height, height / width);
  if (ratio > ASPECT_RATIO_INADEQUATE) errors.push(issue('LOGO_EXTREME_ASPECT_RATIO', 'A proporção da logo é extrema demais para um overlay previsível.'));
  else if (ratio > ASPECT_RATIO_WARNING) warnings.push(issue('LOGO_UNUSUAL_ASPECT_RATIO', 'A proporção da logo é bastante alongada.'));

  const quality = errors.length ? 'inadequate' : warnings.length ? 'acceptable_with_warning' : 'adequate';
  return { quality, errors, warnings };
}

function issue(code, message) {
  return Object.freeze({ code, message });
}

function round(value) {
  return Number.isFinite(value) ? Number(value.toFixed(4)) : null;
}

function sanitizeFileName(name) {
  const base = path.basename(String(name || 'logo.png'));
  const sanitized = base.replace(/[^\w.\-]/g, '_').slice(0, 120);
  return sanitized || 'logo.png';
}
