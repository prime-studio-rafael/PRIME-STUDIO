import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { generationConfig } from '../config/generationConfig.js';
import { validateImageBuffer } from '../utils/fileValidation.js';

const templatesDirectory = path.resolve(process.cwd(), 'public/templates');

const templates = Object.freeze([
  {
    id: 'model-01',
    label: 'Modelo base 01',
    description: 'Fotografia local do modelo-base.',
    filename: 'model-01.jpeg',
    publicUrl: '/templates/model-01.jpeg',
    expectedMimeType: 'image/jpeg',
    isPlaceholder: false,
  },
  {
    id: 'model-02',
    label: 'Modelo base 02',
    description: 'Fotografia local do modelo-base.',
    filename: 'model-02.jpeg',
    publicUrl: '/templates/model-02.jpeg',
    expectedMimeType: 'image/jpeg',
    isPlaceholder: false,
  },
]);

export function listTemplates() {
  return templates;
}

export function getTemplateById(id) {
  const template = templates.find((item) => item.id === id);
  return template ? { ...template, filePath: path.join(templatesDirectory, template.filename) } : null;
}

/**
 * Inspects one local template without exposing its filesystem path. This is
 * deliberately kept in the catalog layer so the API and generation service
 * share the same validation rules.
 */
export async function inspectTemplate(template) {
  const { filePath: suppliedFilePath, ...publicTemplate } = template;
  const filePath = suppliedFilePath || path.join(templatesDirectory, template.filename);
  let stats;
  let buffer;

  try {
    [buffer, stats] = await Promise.all([readFile(filePath), stat(filePath)]);
  } catch (error) {
    const exists = error?.code !== 'ENOENT';
    return invalidTemplate(publicTemplate, {
      exists,
      sizeBytes: 0,
      message: exists ? 'Não foi possível ler o arquivo local.' : 'Template não encontrado no caminho local.',
    });
  }

  try {
    const inspected = validateImageBuffer(buffer, {
      maxBytes: generationConfig.maxFileSizeBytes,
      fieldLabel: template.label,
      fileName: template.filename,
      expectedMimeType: template.expectedMimeType,
      declaredAspectRatio: template.declaredAspectRatio,
      role: 'template',
    });

    return {
      ...publicTemplate,
      exists: true,
      valid: true,
      mimeType: inspected.mimeType,
      realFormat: inspected.format,
      width: inspected.dimensions.width,
      height: inspected.dimensions.height,
      aspectRatio: inspected.aspectRatio,
      aspectRatioLabel: inspected.inspection.aspectRatioLabel,
      orientation: inspected.orientation,
      sizeBytes: stats.size,
      quality: inspected.validation.quality,
      qualityLabel: inspected.validation.qualityLabel,
      warnings: inspected.validation.warnings,
      extensionMatches: inspected.validation.extensionMatches,
      mimeMatches: inspected.validation.mimeMatches,
      fourByFiveReady: inspected.validation.fourByFiveReady,
      validationError: null,
    };
  } catch (error) {
    return invalidTemplate(publicTemplate, {
      exists: true,
      sizeBytes: stats.size,
      message: `Template inválido: ${error?.message || 'arquivo de imagem incompatível.'}`,
    });
  }
}

export async function inspectTemplates() {
  return Promise.all(templates.map((template) => inspectTemplate(template)));
}

function invalidTemplate(template, { exists, sizeBytes, message }) {
  return {
    ...template,
    exists,
    valid: false,
    mimeType: null,
    realFormat: null,
    width: null,
    height: null,
    aspectRatio: null,
    aspectRatioLabel: null,
    orientation: null,
    sizeBytes,
    quality: 'unsuitable',
    qualityLabel: 'Inadequada',
    warnings: [],
    extensionMatches: false,
    mimeMatches: false,
    fourByFiveReady: false,
    validationError: message,
  };
}
