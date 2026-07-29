import { Router } from 'express';

export function createHealthRouter({ keyResolver, localHealthService }) {
  const router = Router();
  router.get('/', async (_request, response, next) => {
    try {
      const keyStatus = await keyResolver.getStatus();
      const local = localHealthService ? await localHealthService.getStatus() : { storage: { status: 'unknown' }, renderer: { status: 'unknown' } };
      response.json({ status: 'ok', keyConfigured: keyStatus.configured, ...local });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
