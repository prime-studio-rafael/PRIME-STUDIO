import path from 'node:path';
import { Router } from 'express';
import { ZipFile } from 'yazl';

function uniqueZipEntryName(usedNames, filename) {
  const safeName = path.basename(filename);
  if (!usedNames.has(safeName)) { usedNames.add(safeName); return safeName; }
  const extension = path.extname(safeName);
  const base = safeName.slice(0, safeName.length - extension.length);
  let attempt = 2;
  let candidate = `${base}-${attempt}${extension}`;
  while (usedNames.has(candidate)) { attempt += 1; candidate = `${base}-${attempt}${extension}`; }
  usedNames.add(candidate);
  return candidate;
}

export function createResultsRouter({ resultService }) {
  const router = Router();
  router.use((_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  router.get('/', async (_request, response, next) => { try { response.json(await resultService.list()); } catch (error) { next(error); } });
  router.get('/download/approved', async (_request, response, next) => {
    try {
      const files = await resultService.listApprovedAssets();
      const zipfile = new ZipFile();
      const usedNames = new Set();
      for (const file of files) zipfile.addBuffer(file.buffer, uniqueZipEntryName(usedNames, file.filename));
      const dateStamp = new Date().toISOString().slice(0, 10);
      response.status(200);
      response.type('application/zip');
      response.set('Content-Disposition', `attachment; filename="prime-studio-aprovadas-${dateStamp}.zip"`);
      zipfile.outputStream.on('error', next);
      zipfile.outputStream.pipe(response);
      zipfile.end();
    } catch (error) { next(error); }
  });
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
