import { Router } from 'express';

export function createTemplatesRouter({ templateCatalog }) {
  const router = Router();
  router.get('/', async (_request, response, next) => {
    try {
      const templates = templateCatalog.inspectTemplates
        ? await templateCatalog.inspectTemplates()
        : templateCatalog.listTemplates();
      response.json({ templates });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
