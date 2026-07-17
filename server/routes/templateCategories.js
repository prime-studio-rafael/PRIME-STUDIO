import { Router } from 'express';
import { listTemplateCategories } from '../catalogs/templateCategories.js';

export function createTemplateCategoriesRouter() {
  const router = Router();
  router.use((_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  router.get('/', (_request, response) => {
    response.json({ categories: listTemplateCategories() });
  });
  return router;
}
