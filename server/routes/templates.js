import { Router, json } from 'express';
import multer from 'multer';
import { generationConfig } from '../config/generationConfig.js';

export function createTemplatesRouter({ templateService }) {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: generationConfig.maxFileSizeBytes },
  });
  router.use(json({ limit: '32kb' }));

  router.get('/', async (_request, response, next) => {
    try {
      response.json({ templates: await templateService.list() });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', upload.single('templateImage'), async (request, response, next) => {
    try {
      const template = await templateService.create({
        label: request.body.label,
        description: request.body.description,
        file: request.file,
      });
      response.status(201).json({ template });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:id', async (request, response, next) => {
    try {
      const template = await templateService.update(request.params.id, {
        label: request.body?.label,
        description: request.body?.description,
      });
      response.json({ template });
    } catch (error) {
      next(error);
    }
  });

  router.put('/:id/image', upload.single('templateImage'), async (request, response, next) => {
    try {
      const template = await templateService.replaceImage(request.params.id, request.file);
      response.json({ template });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/duplicate', async (request, response, next) => {
    try {
      const template = await templateService.duplicate(request.params.id);
      response.status(201).json({ template });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:id/status', async (request, response, next) => {
    try {
      const template = await templateService.setActive(request.params.id, request.body?.active);
      response.json({ template });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', async (request, response, next) => {
    try {
      await templateService.delete(request.params.id);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id/image', async (request, response, next) => {
    try {
      const image = await templateService.getImage(request.params.id);
      response.set({
        'Content-Type': image.mimeType,
        'Content-Length': String(image.buffer.length),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      response.send(image.buffer);
    } catch (error) {
      next(error);
    }
  });
  return router;
}
