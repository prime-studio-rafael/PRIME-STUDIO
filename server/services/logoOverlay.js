import sharp from 'sharp';
import { AppError } from '../utils/errors.js';

// Padrão definitivo do PRIME STUDIO, validado visualmente em 17 de julho de 2026
// com um resultado real e a logo aprovada da PRIME STORE (acabamento nível Shopify/Canva Pro):
// a logo reforça a marca sem competir com o produto, legível em qualquer canal (Instagram,
// catálogo, marketplace, e-commerce), nunca cortada, nunca deformada, nunca colada na borda.
export const LOGO_POSITION = 'bottom-right';
export const LOGO_SCALE_RATIO = 0.09; // ~9% da menor dimensão da imagem final (faixa validada: 8%–10%)
export const LOGO_MARGIN_RATIO = 0.03; // ~3% da menor dimensão da imagem final (~24-32px em resoluções de referência)
const JPEG_QUALITY = 92;
const WEBP_QUALITY = 92;

/**
 * Composição tradicional (sem IA) de uma logo PNG transparente sobre um resultado já gerado.
 * Determinística: mesma entrada produz a mesma saída. Nenhuma chamada externa.
 */
export async function applyLogoOverlay({
  resultBuffer,
  resultMimeType,
  logoBuffer,
  scaleRatio = LOGO_SCALE_RATIO,
  marginRatio = LOGO_MARGIN_RATIO,
} = {}) {
  if (!resultBuffer || !logoBuffer) {
    throw new AppError('BRANDING_OVERLAY_MISSING_INPUT', 'Entrada inválida para aplicar a logo.', { status: 500 });
  }

  let baseMeta;
  try {
    baseMeta = await sharp(resultBuffer).metadata();
  } catch (error) {
    throw new AppError('BRANDING_OVERLAY_INVALID_RESULT', 'Não foi possível ler a imagem gerada para aplicar a logo.', { status: 500, cause: error });
  }
  const { width, height } = baseMeta;
  if (!width || !height) {
    throw new AppError('BRANDING_OVERLAY_INVALID_RESULT', 'A imagem gerada não possui dimensões válidas.', { status: 500 });
  }

  let logoMeta;
  try {
    logoMeta = await sharp(logoBuffer).metadata();
  } catch (error) {
    throw new AppError('BRANDING_OVERLAY_INVALID_LOGO', 'Não foi possível ler a logo para aplicar o overlay.', { status: 500, cause: error });
  }

  const minDimension = Math.min(width, height);
  const targetLogoWidth = Math.max(1, Math.round(minDimension * scaleRatio));
  // Nunca amplia a logo além da resolução original, para não perder nitidez.
  const finalLogoWidth = Math.min(targetLogoWidth, logoMeta.width);
  const margin = Math.max(0, Math.round(minDimension * marginRatio));

  let resizedLogoBuffer = logoBuffer;
  let resizedMeta = logoMeta;
  if (finalLogoWidth < logoMeta.width) {
    resizedLogoBuffer = await sharp(logoBuffer).resize({ width: finalLogoWidth, withoutEnlargement: true }).png().toBuffer();
    resizedMeta = await sharp(resizedLogoBuffer).metadata();
  }

  const left = Math.max(0, width - resizedMeta.width - margin);
  const top = Math.max(0, height - resizedMeta.height - margin);

  const composed = sharp(resultBuffer).composite([{ input: resizedLogoBuffer, left, top }]);
  const { buffer, mimeType } = await encode(composed, resultMimeType);

  return {
    buffer,
    mimeType,
    dimensions: { width, height },
    logoDimensions: { width: resizedMeta.width, height: resizedMeta.height },
    scale: Number((resizedMeta.width / minDimension).toFixed(4)),
    margin,
    position: LOGO_POSITION,
  };
}

async function encode(pipeline, mimeType) {
  if (mimeType === 'image/jpeg') return { buffer: await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer(), mimeType: 'image/jpeg' };
  if (mimeType === 'image/png') return { buffer: await pipeline.png().toBuffer(), mimeType: 'image/png' };
  if (mimeType === 'image/webp') return { buffer: await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer(), mimeType: 'image/webp' };
  throw new AppError('BRANDING_OVERLAY_UNSUPPORTED_MIME', 'Formato de imagem não suportado para aplicar a logo.', { status: 500 });
}
