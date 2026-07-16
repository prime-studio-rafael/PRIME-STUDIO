import { inspectImageBytes } from '../../../../shared/imageInspection.js';
import { assessImage, imagePolicy } from '../../../../shared/imagePolicy.js';
import { withBlockingError } from '../../generation/utils/inspectUpload.js';

export async function inspectTemplateFile(file, policy = imagePolicy) {
  const bytes = await file.arrayBuffer();
  const inspection = inspectImageBytes(bytes);
  let assessment = assessImage({
    inspection,
    fileName: file.name,
    reportedMimeType: file.type,
    role: 'template',
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
