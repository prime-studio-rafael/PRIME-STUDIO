import { once } from 'node:events';
import { readFileSync } from 'node:fs';

export async function startTestServer(app) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  };
}

export function validWebpBuffer() {
  return readFileSync(new URL('../../public/templates/00model-01.webp', import.meta.url));
}

export function generationForm({
  templateId = 'model-01',
  modelId = 'nano-banana-2-lite',
  confirmPaid = 'true',
  buffer = validWebpBuffer(),
  mimeType = 'image/webp',
  includeFile = true,
} = {}) {
  const form = new FormData();
  form.set('templateId', templateId);
  form.set('modelId', modelId);
  if (confirmPaid !== null) {
    form.set('confirmPaid', confirmPaid);
  }
  if (includeFile) {
    form.set('garmentImage', new Blob([buffer], { type: mimeType }), 'garment.webp');
  }
  return form;
}
