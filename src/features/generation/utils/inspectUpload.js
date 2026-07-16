import { inspectImageBytes } from '../../../../shared/imageInspection.js';
import { assessImage, imagePolicy } from '../../../../shared/imagePolicy.js';

export async function inspectGarmentFile(file, policy = imagePolicy) {
  const bytes = await file.arrayBuffer();
  const inspection = inspectImageBytes(bytes);
  let assessment = assessImage({
    inspection,
    fileName: file.name,
    reportedMimeType: file.type,
    role: 'garment',
    policy,
  });

  if (assessment.valid && typeof globalThis.createImageBitmap === 'function') {
    try {
      const bitmap = await globalThis.createImageBitmap(file);
      const dimensionsMatch = bitmap.width === inspection.width && bitmap.height === inspection.height;
      bitmap.close?.();
      if (!dimensionsMatch) {
        assessment = withBlockingError(assessment, 'DECODE_DIMENSIONS_MISMATCH', 'As dimensões decodificadas não correspondem ao cabeçalho da imagem.');
      }
    } catch {
      assessment = withBlockingError(assessment, 'IMAGE_DECODE_FAILED', 'O navegador não conseguiu decodificar a imagem completa. Exporte o arquivo novamente.');
    }
  }

  return { inspection, ...assessment };
}

export function withBlockingError(assessment, code, message) {
  if (assessment.errors.some((error) => error.code === code)) return assessment;
  return {
    ...assessment,
    valid: false,
    quality: 'unsuitable',
    qualityLabel: 'Inadequada',
    errors: [...assessment.errors, { code, message }],
  };
}
