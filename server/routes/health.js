import { Router } from 'express';

export function createHealthRouter({ keyResolver }) {
  const router = Router();
  router.get('/', async (_request, response, next) => {
    try {
      const keyStatus = await keyResolver.getStatus();
      response.json({ status: 'ok', keyConfigured: keyStatus.configured });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
