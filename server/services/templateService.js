import { generationConfig } from '../config/generationConfig.js';
import { AppError } from '../utils/errors.js';
import { validateImageBuffer } from '../utils/fileValidation.js';
import { DEFAULT_TEMPLATE_CATEGORY_ID, isKnownTemplateCategory } from '../catalogs/templateCategories.js';

const LABEL_MAX_LENGTH = 80;
const DESCRIPTION_MAX_LENGTH = 240;
const HOVER_DESCRIPTION_MAX_LENGTH = 160;
const TAG_MAX_COUNT = 8;
const TAG_MAX_LENGTH = 24;

export function createTemplateService({
  repository,
  config = generationConfig,
  isGenerationActive = () => false,
} = {}) {
  if (!repository) throw new TypeError('TemplateRepository is required.');
  let activeMutations = 0;

  async function list() {
    const records = await repository.list();
    return Promise.all(records.map(inspectRecord));
  }

  async function listPage({ page, pageSize, search, category } = {}) {
    const result = await repository.listPage({ page, pageSize, search, category });
    const templates = await Promise.all(result.templates.map(inspectRecord));
    return { templates, page: result.page, pageSize: result.pageSize, total: result.total };
  }

  async function getForGeneration(id) {
    const record = await repository.getById(id);
    if (!record) throw new AppError('INVALID_TEMPLATE', 'O template selecionado não existe.', { status: 400 });
    if (!record.active) throw new AppError('INACTIVE_TEMPLATE', 'O template selecionado está inativo.', { status: 400 });

    const resolved = await inspectRecordWithBytes(record);
    if (!resolved.publicTemplate.valid) {
      throw new AppError('INVALID_TEMPLATE', resolved.publicTemplate.validationError || 'O template selecionado está inválido.', { status: 400 });
    }
    return resolved;
  }

  async function getImage(id) {
    const record = await repository.getById(id);
    if (!record) throw new AppError('TEMPLATE_NOT_FOUND', 'O template selecionado não existe.', { status: 404 });
    const resolved = await inspectRecordWithBytes(record);
    if (!resolved.publicTemplate.valid) {
      throw new AppError('INVALID_TEMPLATE', resolved.publicTemplate.validationError || 'A imagem deste template está inválida.', { status: 422 });
    }
    return { buffer: resolved.image.buffer, mimeType: resolved.image.mimeType, updatedAt: record.updatedAt };
  }

  async function create({ label, description, category, tags, hoverDescription, file }) {
    return runMutation(async () => {
      const data = await validateFields({ label, description, category, tags, hoverDescription });
      await assertUniqueLabel(data.label);
      const image = validateUpload(file);
      const record = await repository.create(data, image);
      return inspectRecord(record);
    });
  }

  async function update(id, { label, description, category, tags, hoverDescription }) {
    return runMutation(async () => {
      const current = await requireRecord(id);
      const data = await validateFields({
        label: label === undefined ? current.label : label,
        description: description === undefined ? current.description : description,
        category: category === undefined ? current.category : category,
        tags: tags === undefined ? current.tags : tags,
        hoverDescription: hoverDescription === undefined ? current.hoverDescription : hoverDescription,
      });
      await assertUniqueLabel(data.label, id);
      return inspectRecord(await repository.update(id, data));
    });
  }

  async function replaceImage(id, file) {
    return runMutation(async () => {
      await requireRecord(id);
      const image = validateUpload(file);
      return inspectRecord(await repository.replaceImage(id, image));
    });
  }

  async function duplicate(id) {
    return runMutation(async () => {
      const current = await inspectRecord(await requireRecord(id));
      if (!current.valid) throw new AppError('INVALID_TEMPLATE', 'Um template inválido não pode ser duplicado.', { status: 400 });
      return inspectRecord(await repository.duplicate(id));
    });
  }

  async function setActive(id, active) {
    return runMutation(async () => {
      if (typeof active !== 'boolean') throw new AppError('INVALID_TEMPLATE_STATUS', 'Informe um status válido para o template.', { status: 400 });
      const target = await inspectRecord(await requireRecord(id));
      if (active && !target.valid) throw new AppError('INVALID_TEMPLATE', 'Um template inválido não pode ser ativado.', { status: 400 });
      if (!active && target.active && target.valid) await assertAnotherActiveValid(id);
      return inspectRecord(await repository.setActive(id, active));
    });
  }

  async function remove(id) {
    return runMutation(async () => {
      const target = await inspectRecord(await requireRecord(id));
      if (target.active && target.valid) await assertAnotherActiveValid(id);
      await repository.delete(id);
    });
  }

  async function inspectRecord(record) {
    return (await inspectRecordWithBytes(record)).publicTemplate;
  }

  async function inspectRecordWithBytes(record) {
    try {
      const { buffer } = await repository.readImage(record.id);
      const validated = validateImageBuffer(buffer, {
        maxBytes: config.maxFileSizeBytes,
        fieldLabel: record.label,
        fileName: record.storageKey,
        expectedMimeType: record.mimeType,
        role: 'template',
        policy: config.imagePolicy,
      });
      return {
        publicTemplate: publicTemplate(record, validated),
        image: validated,
      };
    } catch (error) {
      return {
        publicTemplate: invalidPublicTemplate(record, error),
        image: null,
      };
    }
  }

  function validateUpload(file) {
    if (!file?.buffer?.length) throw new AppError('MISSING_TEMPLATE_IMAGE', 'Selecione uma imagem para o template.', { status: 400 });
    if (!config.allowedMimeTypes.includes(file.mimetype)) throw new AppError('UNSUPPORTED_MIME', 'Use uma imagem JPEG, PNG ou WebP.', { status: 400 });
    const validated = validateImageBuffer(file.buffer, {
      maxBytes: config.maxFileSizeBytes,
      fieldLabel: 'Imagem do template',
      fileName: file.originalname,
      expectedMimeType: file.mimetype,
      role: 'template',
      policy: config.imagePolicy,
    });
    return {
      buffer: validated.buffer,
      mimeType: validated.mimeType,
      width: validated.dimensions.width,
      height: validated.dimensions.height,
      aspectRatio: validated.aspectRatio,
      sizeBytes: validated.buffer.length,
      valid: true,
      warnings: validated.validation.warnings,
    };
  }

  async function validateFields({ label, description = '', category, tags = [], hoverDescription = '' }) {
    const normalizedLabel = String(label || '').trim().replace(/\s+/g, ' ');
    const normalizedDescription = String(description || '').trim().replace(/\s+/g, ' ');
    if (!normalizedLabel) throw new AppError('TEMPLATE_LABEL_REQUIRED', 'Informe um nome para o template.', { status: 400 });
    if (normalizedLabel.length > LABEL_MAX_LENGTH) throw new AppError('TEMPLATE_LABEL_TOO_LONG', `O nome deve ter no máximo ${LABEL_MAX_LENGTH} caracteres.`, { status: 400 });
    if (normalizedDescription.length > DESCRIPTION_MAX_LENGTH) throw new AppError('TEMPLATE_DESCRIPTION_TOO_LONG', `A descrição deve ter no máximo ${DESCRIPTION_MAX_LENGTH} caracteres.`, { status: 400 });

    const normalizedCategory = category ? String(category).trim() : DEFAULT_TEMPLATE_CATEGORY_ID;
    if (!isKnownTemplateCategory(normalizedCategory)) throw new AppError('TEMPLATE_CATEGORY_INVALID', 'Selecione uma categoria válida para o template.', { status: 400 });

    const normalizedTags = normalizeTags(tags);

    const normalizedHoverDescription = hoverDescription == null ? '' : String(hoverDescription).trim().replace(/\s+/g, ' ');
    if (normalizedHoverDescription.length > HOVER_DESCRIPTION_MAX_LENGTH) throw new AppError('TEMPLATE_HOVER_DESCRIPTION_TOO_LONG', `O texto do tooltip deve ter no máximo ${HOVER_DESCRIPTION_MAX_LENGTH} caracteres.`, { status: 400 });

    return {
      label: normalizedLabel,
      description: normalizedDescription,
      category: normalizedCategory,
      tags: normalizedTags,
      hoverDescription: normalizedHoverDescription || null,
    };
  }

  function normalizeTags(tags) {
    const list = Array.isArray(tags) ? tags : [];
    const seen = new Set();
    const normalized = [];
    for (const rawTag of list) {
      const tag = String(rawTag ?? '').trim().toLocaleLowerCase('pt-BR');
      if (!tag) continue;
      if (tag.length > TAG_MAX_LENGTH) throw new AppError('TEMPLATE_TAG_TOO_LONG', `Cada tag deve ter no máximo ${TAG_MAX_LENGTH} caracteres.`, { status: 400 });
      if (seen.has(tag)) continue;
      seen.add(tag);
      normalized.push(tag);
    }
    if (normalized.length > TAG_MAX_COUNT) throw new AppError('TEMPLATE_TAGS_TOO_MANY', `Use no máximo ${TAG_MAX_COUNT} tags por template.`, { status: 400 });
    return normalized;
  }

  async function assertUniqueLabel(label, ignoredId) {
    const normalized = label.toLocaleLowerCase('pt-BR');
    const duplicate = (await repository.list()).find((template) => template.id !== ignoredId && template.label.toLocaleLowerCase('pt-BR') === normalized);
    if (duplicate) throw new AppError('TEMPLATE_LABEL_DUPLICATE', 'Já existe um template com este nome.', { status: 409 });
  }

  async function assertAnotherActiveValid(ignoredId) {
    const templates = await list();
    if (!templates.some((template) => template.id !== ignoredId && template.active && template.valid)) {
      throw new AppError('LAST_ACTIVE_TEMPLATE', 'Mantenha pelo menos um template válido e ativo.', { status: 409 });
    }
  }

  async function requireRecord(id) {
    const record = await repository.getById(id);
    if (!record) throw new AppError('TEMPLATE_NOT_FOUND', 'O template selecionado não existe.', { status: 404 });
    return record;
  }

  function assertMutable() {
    if (isGenerationActive()) {
      throw new AppError('GENERATION_IN_PROGRESS', 'Aguarde a geração atual terminar antes de alterar templates.', { status: 409 });
    }
  }

  function runMutation(operation) {
    assertMutable();
    activeMutations += 1;
    return Promise.resolve()
      .then(operation)
      .finally(() => { activeMutations -= 1; });
  }

  return Object.freeze({
    list,
    listPage,
    getForGeneration,
    getImage,
    create,
    update,
    replaceImage,
    duplicate,
    setActive,
    delete: remove,
    isBusy: () => activeMutations > 0,
  });
}

function publicTemplate(record, image) {
  return {
    id: record.id,
    label: record.label,
    description: record.description,
    filename: record.storageKey,
    publicUrl: `/api/templates/${encodeURIComponent(record.id)}/image?v=${encodeURIComponent(record.updatedAt)}`,
    expectedMimeType: record.mimeType,
    isPlaceholder: false,
    exists: true,
    valid: true,
    active: record.active,
    mimeType: image.mimeType,
    realFormat: image.format,
    width: image.dimensions.width,
    height: image.dimensions.height,
    aspectRatio: image.aspectRatio,
    aspectRatioLabel: image.inspection.aspectRatioLabel,
    orientation: image.orientation,
    sizeBytes: image.buffer.length,
    quality: image.validation.quality,
    qualityLabel: image.validation.qualityLabel,
    warnings: image.validation.warnings.map(({ code, message }) => ({ code, message })),
    extensionMatches: image.validation.extensionMatches,
    mimeMatches: image.validation.mimeMatches,
    fourByFiveReady: image.validation.fourByFiveReady,
    validationError: null,
    category: record.category,
    tags: record.tags,
    hoverDescription: record.hoverDescription,
    usageMetrics: record.usageMetrics,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function invalidPublicTemplate(record, error) {
  return {
    id: record.id,
    label: record.label,
    description: record.description,
    filename: record.storageKey,
    publicUrl: `/api/templates/${encodeURIComponent(record.id)}/image?v=${encodeURIComponent(record.updatedAt)}`,
    expectedMimeType: record.mimeType,
    isPlaceholder: false,
    exists: error?.code !== 'TEMPLATE_IMAGE_MISSING',
    valid: false,
    active: record.active,
    mimeType: null,
    realFormat: null,
    width: null,
    height: null,
    aspectRatio: null,
    aspectRatioLabel: null,
    orientation: null,
    sizeBytes: record.sizeBytes,
    quality: 'unsuitable',
    qualityLabel: 'Inadequada',
    warnings: [],
    extensionMatches: false,
    mimeMatches: false,
    fourByFiveReady: false,
    validationError: error?.message || 'A imagem local deste template está inválida.',
    category: record.category,
    tags: record.tags,
    hoverDescription: record.hoverDescription,
    usageMetrics: record.usageMetrics,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
