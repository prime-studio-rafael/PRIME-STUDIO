import { getFileExtension, getFormatDetails, IMAGE_FORMATS } from './imageInspection.js';

const allowedMimeTypes = Object.freeze(Object.values(IMAGE_FORMATS).map(({ mimeType }) => mimeType));

export const imagePolicy = deepFreeze({
  version: 'image-policy-v1',
  maxFileSizeBytes: 10 * 1024 * 1024,
  allowedMimeTypes,
  formats: IMAGE_FORMATS,
  template: {
    minWidth: 768,
    minHeight: 960,
    minPixels: 750_000,
    targetAspectRatio: '4:5',
    targetAspectRatioValue: 4 / 5,
    aspectRatioTolerance: 0.015,
    compressionWarningBytesPerPixel: 0.08,
    requirePortrait: true,
  },
  garment: {
    minWidth: 512,
    minHeight: 512,
    minPixels: 350_000,
    preferredAspectRatioMin: 0.68,
    preferredAspectRatioMax: 1.05,
    compressionWarningBytesPerPixel: 0.06,
  },
});

export function assessImage({ inspection, fileName, reportedMimeType, role = 'generic', declaredAspectRatio, policy = imagePolicy }) {
  const errors = [];
  const warnings = [];
  const info = [];
  const extension = getFileExtension(fileName);
  const formatDetails = inspection.format ? getFormatDetails(inspection.format) : null;

  if (!inspection.integrity.valid) {
    errors.push(issue(inspection.integrity.code, inspection.integrity.message));
  }

  if (inspection.sizeBytes === 0) errors.push(issue('EMPTY_FILE', 'O arquivo está vazio.'));
  if (inspection.sizeBytes > policy.maxFileSizeBytes) errors.push(issue('FILE_TOO_LARGE', 'A imagem deve ter no máximo 10 MB.'));

  if (inspection.mimeType && !policy.allowedMimeTypes.includes(inspection.mimeType)) {
    errors.push(issue('UNSUPPORTED_MIME', 'Use uma imagem JPEG, PNG ou WebP.'));
  }
  if (reportedMimeType && !policy.allowedMimeTypes.includes(reportedMimeType)) {
    errors.push(issue('UNSUPPORTED_MIME', 'Use uma imagem JPEG, PNG ou WebP.'));
  } else if (reportedMimeType && inspection.mimeType && reportedMimeType !== inspection.mimeType) {
    errors.push(issue('MIME_SIGNATURE_MISMATCH', `O MIME informado (${reportedMimeType}) não corresponde aos bytes ${inspection.mimeType}.`));
  }

  const extensionMatches = Boolean(extension && formatDetails?.extensions.includes(extension));
  if (inspection.format && fileName && !extensionMatches) {
    errors.push(issue('EXTENSION_SIGNATURE_MISMATCH', `A extensão .${extension || 'ausente'} não corresponde ao formato real ${formatDetails.label}.`));
  }

  if (inspection.orientation.requiresTransform) {
    errors.push(issue('EXIF_ORIENTATION_REQUIRED', `A imagem exige transformação EXIF (${inspection.orientation.label}). Exporte-a já na orientação correta.`));
  }

  const requirements = role === 'template' ? policy.template : role === 'garment' ? policy.garment : null;
  if (requirements && inspection.integrity.valid) {
    const tooNarrow = inspection.width < requirements.minWidth;
    const tooShort = inspection.height < requirements.minHeight;
    const tooFewPixels = (inspection.width * inspection.height) < requirements.minPixels;
    if (tooNarrow || tooShort || tooFewPixels) {
      errors.push(issue(
        'IMAGE_DIMENSIONS_TOO_SMALL',
        `Dimensões insuficientes: mínimo ${requirements.minWidth}×${requirements.minHeight} e pelo menos ${formatPixels(requirements.minPixels)}.`,
      ));
    }

    if (role === 'template') {
      if (requirements.requirePortrait && inspection.width >= inspection.height) {
        errors.push(issue('TEMPLATE_NOT_PORTRAIT', 'O template deve estar em orientação vertical.'));
      }
      if (!isTargetAspectRatio(inspection.aspectRatio, requirements)) {
        warnings.push(issue('TEMPLATE_RATIO_NOT_4_5', `A proporção real ${formatRatio(inspection.aspectRatio)} não está dentro da tolerância de ${requirements.targetAspectRatio}.`));
      }
      if (declaredAspectRatio && !ratioDeclarationMatches(declaredAspectRatio, inspection.aspectRatio, requirements.aspectRatioTolerance)) {
        errors.push(issue('DECLARED_RATIO_MISMATCH', `A proporção declarada ${declaredAspectRatio} não corresponde às dimensões reais.`));
      }
    }

    if (role === 'garment' && (inspection.aspectRatio < requirements.preferredAspectRatioMin || inspection.aspectRatio > requirements.preferredAspectRatioMax)) {
      warnings.push(issue('GARMENT_RATIO_SUBOPTIMAL', 'A roupa funciona melhor em imagem vertical ou próxima de quadrada, com a peça inteira visível.'));
    }

    const bytesPerPixel = inspection.sizeBytes / Math.max(1, inspection.width * inspection.height);
    if (bytesPerPixel < requirements.compressionWarningBytesPerPixel) {
      warnings.push(issue('POSSIBLE_STRONG_COMPRESSION', 'O arquivo tem poucos bytes para sua resolução e pode ter compressão forte. Evite imagens reenviadas pelo WhatsApp.'));
    }
  }

  if (inspection.integrity.valid) {
    info.push(issue('IMAGE_TECHNICAL_INFO', `${inspection.width}×${inspection.height} · ${formatDetails?.label || inspection.format} · ${formatBytes(inspection.sizeBytes)}`));
  }

  const valid = errors.length === 0;
  const fourByFiveReady = role === 'template'
    && valid
    && isTargetAspectRatio(inspection.aspectRatio, policy.template);

  return {
    valid,
    quality: !valid ? 'unsuitable' : warnings.length > 0 ? 'acceptable-with-warning' : 'adequate',
    qualityLabel: !valid ? 'Inadequada' : warnings.length > 0 ? 'Aceitável com aviso' : 'Adequada',
    errors,
    warnings,
    info,
    extension,
    extensionMatches,
    mimeMatches: !reportedMimeType || reportedMimeType === inspection.mimeType,
    fourByFiveReady,
  };
}

export function isTargetAspectRatio(value, requirements = imagePolicy.template) {
  return Number.isFinite(value)
    && Math.abs(value - requirements.targetAspectRatioValue) <= requirements.aspectRatioTolerance;
}

export function formatRatio(value) {
  return Number.isFinite(value) ? value.toFixed(3).replace('.', ',') : 'não identificada';
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'tamanho desconhecido';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2).replace('.', ',')} MB`;
}

function ratioDeclarationMatches(declaration, actual, tolerance) {
  const [width, height] = String(declaration).split(':').map(Number);
  if (!width || !height || !Number.isFinite(actual)) return false;
  return Math.abs((width / height) - actual) <= tolerance;
}

function formatPixels(pixels) {
  return `${(pixels / 1_000_000).toFixed(2).replace('.', ',')} MP`;
}

function issue(code, message) {
  return Object.freeze({ code, message });
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
