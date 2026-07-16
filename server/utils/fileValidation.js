import { AppError } from './errors.js';
import { inspectImageBytes } from '../../shared/imageInspection.js';
import { assessImage, imagePolicy } from '../../shared/imagePolicy.js';

export function detectImageMime(buffer) {
  return inspectImageBytes(buffer).mimeType;
}

export function validateImageBuffer(buffer, {
  expectedMimeType,
  maxBytes,
  fieldLabel = 'Imagem',
  fileName,
  role = 'generic',
  declaredAspectRatio,
  policy = imagePolicy,
} = {}) {
  if (!buffer || buffer.length === 0) {
    throw new AppError('EMPTY_FILE', `${fieldLabel} está vazia.`, { status: 400 });
  }

  if (maxBytes && buffer.length > maxBytes) {
    throw new AppError('FILE_TOO_LARGE', `${fieldLabel} deve ter no máximo 10 MB.`, { status: 413 });
  }

  const inspection = inspectImageBytes(buffer);
  const validation = assessImage({
    inspection,
    fileName,
    reportedMimeType: expectedMimeType,
    role,
    declaredAspectRatio,
    policy,
  });
  const firstError = validation.errors[0];
  if (firstError) throw new AppError(firstError.code, `${fieldLabel}: ${firstError.message}`, { status: statusFor(firstError.code) });

  return {
    buffer,
    mimeType: inspection.mimeType,
    format: inspection.format,
    dimensions: { width: inspection.width, height: inspection.height },
    aspectRatio: inspection.aspectRatio,
    orientation: inspection.orientation,
    inspection,
    validation,
  };
}

export function validateUploadedImage(file, config) {
  if (!file) {
    throw new AppError('MISSING_GARMENT', 'Envie uma imagem da roupa superior.', { status: 400 });
  }

  const policy = config.imagePolicy || imagePolicy;
  if (!policy.allowedMimeTypes.includes(file.mimetype)) {
    throw new AppError('UNSUPPORTED_MIME', 'Use uma imagem JPG, PNG ou WebP.', { status: 400 });
  }

  return validateImageBuffer(file.buffer, {
    expectedMimeType: file.mimetype,
    maxBytes: policy.maxFileSizeBytes,
    fieldLabel: 'Imagem da roupa',
    fileName: file.originalname,
    role: 'garment',
    policy,
  });
}

export function readImageDimensions(buffer, mimeType = detectImageMime(buffer)) {
  const inspection = inspectImageBytes(buffer);
  if (!inspection.integrity.valid || inspection.mimeType !== mimeType) return null;
  return { width: inspection.width, height: inspection.height };
}

function statusFor(code) {
  return code === 'FILE_TOO_LARGE' ? 413 : 400;
}
