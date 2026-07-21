import { Router } from 'express';

export function createMarketingRouter({ marketingService }) {
  const router = Router();
  router.use((_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });

  router.get('/layouts', (_request, response) => response.json(marketingService.layouts()));
  router.get('/sources', async (_request, response, next) => { try { response.json(await marketingService.listSources()); } catch (error) { next(error); } });
  router.get('/weeks', async (_request, response, next) => { try { response.json(await marketingService.listWeeks()); } catch (error) { next(error); } });
  router.post('/weeks', async (request, response, next) => { try { response.status(201).json(await marketingService.createWeek(request.body || {})); } catch (error) { next(error); } });
  router.get('/weeks/:weekId', async (request, response, next) => { try { response.json(await marketingService.getWeek(request.params.weekId)); } catch (error) { next(error); } });
  router.patch('/weeks/:weekId', async (request, response, next) => { try { response.json(await marketingService.updateWeek(request.params.weekId, request.body || {})); } catch (error) { next(error); } });
  router.post('/weeks/:weekId/approve', async (request, response, next) => { try { response.json(await marketingService.approveWeek(request.params.weekId)); } catch (error) { next(error); } });
  router.post('/weeks/:weekId/draft', async (request, response, next) => { try { response.json(await marketingService.returnToDraft(request.params.weekId)); } catch (error) { next(error); } });
  router.post('/weeks/:weekId/close', async (request, response, next) => { try { response.json(await marketingService.closeWeek(request.params.weekId)); } catch (error) { next(error); } });
  router.post('/weeks/:weekId/proposal', async (request, response, next) => { try { response.json(await marketingService.proposeWeek(request.params.weekId, request.body || {})); } catch (error) { next(error); } });
  router.delete('/weeks/:weekId', async (request, response, next) => { try { response.json(await marketingService.deleteWeek(request.params.weekId)); } catch (error) { next(error); } });

  router.post('/weeks/:weekId/stories', async (request, response, next) => { try { response.status(201).json(await marketingService.addStory(request.params.weekId, request.body || {})); } catch (error) { next(error); } });
  router.patch('/weeks/:weekId/stories/:storyId', async (request, response, next) => { try { response.json(await marketingService.updateStory(request.params.weekId, request.params.storyId, request.body || {})); } catch (error) { next(error); } });
  router.delete('/weeks/:weekId/stories/:storyId', async (request, response, next) => { try { response.json(await marketingService.deleteStory(request.params.weekId, request.params.storyId)); } catch (error) { next(error); } });
  router.post('/weeks/:weekId/stories/:storyId/render', async (request, response, next) => { try { response.json(await marketingService.renderStory(request.params.weekId, request.params.storyId)); } catch (error) { next(error); } });
  router.patch('/weeks/:weekId/stories/:storyId/editorial-status', async (request, response, next) => { try { response.json(await marketingService.setEditorialStatus(request.params.weekId, request.params.storyId, request.body?.editorialStatus)); } catch (error) { next(error); } });
  router.get('/weeks/:weekId/stories/:storyId/assets/:kind', async (request, response, next) => {
    try {
      const asset = await marketingService.readAsset(request.params.weekId, request.params.storyId, request.params.kind);
      response.type(asset.mimeType);
      response.set('Content-Length', String(asset.buffer.length));
      response.set('X-Content-Type-Options', 'nosniff');
      response.set('Content-Disposition', `inline; filename="${asset.fileName}"`);
      response.send(asset.buffer);
    } catch (error) { next(error); }
  });
  return router;
}
