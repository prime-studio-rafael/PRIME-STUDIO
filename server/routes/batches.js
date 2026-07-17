import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { Router } from 'express';
import multer from 'multer';
import { generationConfig } from '../config/generationConfig.js';

export function createBatchesRouter({ batchService, repository, uploadsDir = path.resolve(process.cwd(), 'storage/.batch-uploads') }) {
  mkdirSync(uploadsDir, { recursive: true });
  const upload = multer({ storage: multer.diskStorage({ destination: uploadsDir, filename: (_req, file, callback) => callback(null, `${Date.now()}-${Math.random().toString(36).slice(2)}-${path.basename(file.originalname)}`) }), limits: { fileSize: generationConfig.maxFileSizeBytes, files: 200 } });
  const router = Router(); router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/', async (_req, res, next) => { try { res.json(await batchService.list()); } catch (error) { next(error); } });
  router.post('/', upload.array('garmentImages', 200), async (req, res, next) => { try { res.status(201).json(await batchService.create({ name: req.body.name, templateId: req.body.templateId, files: req.files || [] })); } catch (error) { next(error); } });
  router.get('/:id', async (req, res, next) => { try { res.json(await batchService.get(req.params.id)); } catch (error) { next(error); } });
  router.post('/:id/start', async (req, res, next) => { try { res.json(await batchService.start(req.params.id, { confirmPaid: req.body?.confirmPaid === true })); } catch (error) { next(error); } });
  router.post('/:id/pause', async (req, res, next) => { try { res.json(await batchService.pause(req.params.id)); } catch (error) { next(error); } });
  router.post('/:id/resume', async (req, res, next) => { try { res.json(await batchService.resume(req.params.id)); } catch (error) { next(error); } });
  router.post('/:id/cancel', async (req, res, next) => { try { res.json(await batchService.cancel(req.params.id)); } catch (error) { next(error); } });
  router.get('/:id/items/:itemId/garment', async (req, res, next) => { try { const asset = await repository.readGarment(req.params.id, req.params.itemId); res.type(asset.mimeType).set('Content-Length', String(asset.buffer.length)).set('X-Content-Type-Options', 'nosniff').send(asset.buffer); } catch (error) { next(error); } });
  return router;
}
