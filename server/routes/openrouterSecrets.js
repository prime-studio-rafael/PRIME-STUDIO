import express, { Router } from 'express';
import { AppError } from '../utils/errors.js';

const MAX_API_KEY_LENGTH = 512;
const MIN_API_KEY_LENGTH = 20;

export function createOpenRouterSecretsRouter({ keyStore, keyResolver, keyValidator, onTestResult = async () => {} }) {
  const router = Router();
  router.use(express.json({ limit: '4kb' }));

  router.get('/status', async (_request, response, next) => {
    try {
      response.json(await keyResolver.getStatus());
    } catch (error) {
      next(error);
    }
  });

  router.put('/', async (request, response, next) => {
    let apiKey = '';
    try {
      apiKey = validateApiKey(request.body?.apiKey);
      await keyStore.saveKey(apiKey);
      response.status(201).json({
        configured: true,
        source: 'keychain',
        message: 'Chave salva com segurança no Chaves do macOS.',
      });
    } catch (error) {
      next(error);
    } finally {
      apiKey = '';
    }
  });

  router.delete('/', async (_request, response, next) => {
    try {
      await keyStore.deleteKey();
      const status = await keyResolver.getStatus();
      response.json({
        ...status,
        message: status.source === 'env'
          ? 'A chave salva no Chaves do macOS foi removida. O fallback do .env permanece ativo.'
          : 'A chave salva no Chaves do macOS foi removida.',
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/test', async (_request, response, next) => {
    try {
      const result = await keyValidator.validate();
      await onTestResult(result.valid);
      response.json(result);
    } catch (error) {
      try { await onTestResult(false); } catch { /* o erro original é o relevante */ }
      next(error);
    }
  });

  return router;
}

function validateApiKey(value) {
  if (typeof value !== 'string') {
    throw new AppError('INVALID_OPENROUTER_KEY', 'Informe uma chave do OpenRouter.', { status: 400 });
  }
  const apiKey = value.trim();
  if (!apiKey) {
    throw new AppError('INVALID_OPENROUTER_KEY', 'Informe uma chave do OpenRouter.', { status: 400 });
  }
  if (apiKey.length < MIN_API_KEY_LENGTH) {
    throw new AppError('INVALID_OPENROUTER_KEY', 'A chave informada parece curta demais.', { status: 400 });
  }
  if (apiKey.length > MAX_API_KEY_LENGTH) {
    throw new AppError('INVALID_OPENROUTER_KEY', 'A chave informada é grande demais.', { status: 400 });
  }
  return apiKey;
}
