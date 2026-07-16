import express from 'express';
import multer from 'multer';
import { generationConfig } from './config/generationConfig.js';
import { createConfigRouter } from './routes/config.js';
import { createGenerationsRouter } from './routes/generations.js';
import { createHealthRouter } from './routes/health.js';
import { createTemplatesRouter } from './routes/templates.js';
import { createOpenRouterSecretsRouter } from './routes/openrouterSecrets.js';
import { createGenerationService } from './services/generateImage.js';
import { createLocalResultStorage } from './storage/localResultStorage.js';
import { createLocalTemplateRepository } from './repositories/localTemplateRepository.js';
import { createTemplateService } from './services/templateService.js';
import { createOpenRouterClient } from './providers/openrouter/openrouterClient.js';
import { createOpenRouterKeyValidator } from './providers/openrouter/openrouterKeyValidator.js';
import { createOpenRouterKeyStore } from './secrets/openrouterKeyStore.js';
import { createOpenRouterKeyResolver } from './secrets/openrouterKeyResolver.js';
import { isAppError } from './utils/errors.js';
import { requestLogger } from './utils/requestLogger.js';
import { readEnv } from './config/env.js';

export function createApp({
  env = readEnv(),
  keyStore = createOpenRouterKeyStore(),
  keyResolver = createOpenRouterKeyResolver({ keyStore, getEnvKey: () => env.apiKey }),
  openRouterClient = createOpenRouterClient({
    getOpenRouterApiKey: keyResolver.getOpenRouterApiKey,
    baseUrl: generationConfig.openRouterBaseUrl,
    timeoutMs: generationConfig.timeoutMs,
  }),
  keyValidator = createOpenRouterKeyValidator({
    getOpenRouterApiKey: keyResolver.getOpenRouterApiKey,
    baseUrl: generationConfig.openRouterBaseUrl,
  }),
  resultStorage = createLocalResultStorage(),
  templateRepository,
  templateService,
  generationService,
  generateImage,
} = {}) {
  let resolvedGenerationService;
  const resolvedTemplateRepository = templateRepository || createLocalTemplateRepository();
  const resolvedTemplateService = templateService || createTemplateService({
    repository: resolvedTemplateRepository,
    isGenerationActive: () => Boolean(resolvedGenerationService?.isBusy?.()),
  });
  resolvedGenerationService = generationService || (generateImage ? { generate: generateImage, isBusy: () => false } : createGenerationService({
    openRouterClient,
    resultStorage,
    templateService: resolvedTemplateService,
  }));
  const app = express();
  app.disable('x-powered-by');
  app.use(requestLogger);
  app.use('/api/health', createHealthRouter({ keyResolver }));
  app.use('/api/config', createConfigRouter({ keyResolver }));
  app.use('/api/secrets/openrouter', createOpenRouterSecretsRouter({ keyStore, keyResolver, keyValidator }));
  app.use('/api/templates', createTemplatesRouter({ templateService: resolvedTemplateService }));
  app.use('/api/generations', createGenerationsRouter({ generationService: resolvedGenerationService }));

  app.use((error, _request, response, _next) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return response.status(413).json({ error: { code: 'FILE_TOO_LARGE', message: 'A imagem deve ter no máximo 10 MB.', retryable: false } });
    }

    if (isAppError(error)) {
      return response.status(error.status).json({
        error: { code: error.code, message: error.message, retryable: error.retryable },
      });
    }

    console.error('[server]', error?.message || error);
    return response.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Ocorreu um erro interno. Tente novamente manualmente.', retryable: false },
    });
  });

  return app;
}
