import { Router } from 'express';
import multer from 'multer';
import { generationConfig } from '../config/generationConfig.js';

export function createGenerationsRouter({ generationService }) {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: generationConfig.maxFileSizeBytes },
  });

  router.post('/', upload.single('garmentImage'), async (request, response, next) => {
    try {
      const result = await generationService.generate({
        templateId: request.body.templateId,
        modelId: request.body.modelId,
        confirmPaid: request.body.confirmPaid === 'true',
        garmentFile: request.file,
        additionalInstruction: request.body.additionalInstruction || null,
      });
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
