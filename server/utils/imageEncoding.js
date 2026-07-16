import { AppError } from './errors.js';
import { validateImageBuffer } from './fileValidation.js';

export function bufferToDataUrl(buffer, mimeType) {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function isValidBase64(value) {
  return value.length > 0 && value.length % 4 !== 1 && /^[A-Za-z0-9+/]*={0,2}$/.test(value);
}

export function decodeBase64Image(base64, declaredMimeType = null) {
  const normalized = String(base64 || '').replace(/\s/g, '');
  if (!isValidBase64(normalized)) {
    throw new AppError('INVALID_BASE64', 'O provedor devolveu uma imagem Base64 inválida.', { status: 502 });
  }

  const buffer = Buffer.from(normalized, 'base64');
  let inspected;
  try {
    inspected = validateImageBuffer(buffer, { expectedMimeType: declaredMimeType, fieldLabel: 'Imagem devolvida pelo provedor' });
  } catch (error) {
    throw new AppError('INVALID_OUTPUT_IMAGE', 'O provedor devolveu bytes que não formam uma imagem íntegra.', { status: 502, cause: error });
  }

  return {
    buffer,
    mimeType: inspected.mimeType,
    dimensions: inspected.dimensions,
  };
}
