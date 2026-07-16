import { AppError } from '../../utils/errors.js';
import { decodeBase64Image } from '../../utils/imageEncoding.js';

export function parseOpenRouterImageResponse(response, responseHeaders = null) {
  const body = response?.body || response;
  const image = body?.data?.[0];
  if (!image?.b64_json) {
    throw new AppError('OPENROUTER_IMAGE_MISSING', 'O OpenRouter não devolveu uma imagem.', { status: 502 });
  }

  let decoded;
  try {
    decoded = decodeBase64Image(image.b64_json, image.media_type || null);
  } catch (error) {
    if (error.code === 'INVALID_BASE64') error.code = 'OPENROUTER_INVALID_BASE64';
    throw error;
  }
  const requestId = response?.requestId || responseHeaders?.get?.('x-request-id') || null;
  return {
    ...decoded,
    usage: body.usage || {},
    costUsd: typeof body.usage?.cost === 'number' ? body.usage.cost : null,
    requestId,
  };
}
