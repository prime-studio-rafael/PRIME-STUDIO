import { Router } from 'express';

export function createResultsRouter({ resultService }) {
  const router = Router();
  router.use((_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  router.get('/', async (_request, response, next) => { try { response.json(await resultService.list()); } catch (error) { next(error); } });
  router.get('/:id', async (request, response, next) => { try { response.json(await resultService.get(request.params.id)); } catch (error) { next(error); } });
  router.get('/:id/assets/:type', async (request, response, next) => {
    try {
      const asset = await resultService.readAsset(request.params.id, request.params.type);
      response.type(asset.mimeType);
      response.set('Content-Length', String(asset.buffer.length));
      response.set('X-Content-Type-Options', 'nosniff');
      response.set('Content-Disposition', `inline; filename="${asset.filename}"`);
      response.send(asset.buffer);
    } catch (error) { next(error); }
  });
  router.patch('/:id/status', async (request, response, next) => { try { response.json(await resultService.setReviewStatus(request.params.id, request.body?.reviewStatus)); } catch (error) { next(error); } });
  router.delete('/:id', async (request, response, next) => { try { response.json(await resultService.delete(request.params.id)); } catch (error) { next(error); } });
  return router;
}
