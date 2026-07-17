import { Router } from 'express';
import multer from 'multer';
import { AppError } from '../utils/errors.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

export function createBrandingRouter({ brandingService }) {
  const router = Router();
  router.use((_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });

  router.get('/', async (_request, response, next) => {
    try { response.json(await brandingService.getState()); } catch (error) { next(error); }
  });

  router.post('/logo', upload.single('logo'), async (request, response, next) => {
    try {
      if (!request.file) throw new AppError('BRANDING_LOGO_MISSING', 'Envie um arquivo de logo.', { status: 400 });
      const record = await brandingService.uploadLogo({ buffer: request.file.buffer, mimetype: request.file.mimetype, originalname: request.file.originalname });
      response.status(201).json(record);
    } catch (error) { next(error); }
  });

  router.post('/approve', async (_request, response, next) => {
    try { response.json(await brandingService.approveLogo()); } catch (error) { next(error); }
  });

  router.patch('/config', async (request, response, next) => {
    try { response.json(await brandingService.setConfig({ enabled: request.body?.enabled === true })); } catch (error) { next(error); }
  });

  router.get('/logo', async (request, response, next) => {
    try {
      const variant = request.query.variant === 'pending' ? 'pending' : 'approved';
      const asset = await brandingService.readLogoAsset(variant);
      response.type(asset.mimeType);
      response.set('X-Content-Type-Options', 'nosniff');
      response.set('Content-Length', String(asset.buffer.length));
      response.send(asset.buffer);
    } catch (error) { next(error); }
  });

  router.delete('/logo', async (_request, response, next) => {
    try { response.json(await brandingService.deleteLogo()); } catch (error) { next(error); }
  });

  return router;
}
