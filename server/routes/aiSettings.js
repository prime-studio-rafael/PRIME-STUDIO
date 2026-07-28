import { Router } from 'express';

export function createAiSettingsRouter({ service }) {
  const router = Router();
  router.get('/providers', async (_request, response, next) => { try { response.json({ providers: await service.list() }); } catch (error) { next(error); } });
  router.get('/providers/deepseek', async (_request, response, next) => { try { response.json(await service.getDeepSeek()); } catch (error) { next(error); } });
  router.get('/providers/dashboard-settings', async (_request, response, next) => { try { response.json(await service.getDashboardSettings()); } catch (error) { next(error); } });
  router.patch('/providers/dashboard-settings', async (request, response, next) => { try { response.json(await service.updateDashboardSettings(request.body?.usdToBrlRate)); } catch (error) { next(error); } });
  router.put('/providers/deepseek/key', async (request, response, next) => {
    let apiKey = '';
    try { apiKey = request.body?.apiKey; response.status(201).json(await service.saveDeepSeekKey(apiKey)); }
    catch (error) { next(error); }
    finally { apiKey = ''; }
  });
  router.delete('/providers/deepseek/key', async (_request, response, next) => { try { response.json(await service.removeDeepSeekKey()); } catch (error) { next(error); } });
  router.post('/providers/deepseek/test', async (_request, response, next) => { try { response.json(await service.testDeepSeek()); } catch (error) { next(error); } });
  router.patch('/providers/deepseek/settings', async (request, response, next) => { try { response.json(await service.updateDeepSeekSettings(request.body?.modelId)); } catch (error) { next(error); } });
  return router;
}
