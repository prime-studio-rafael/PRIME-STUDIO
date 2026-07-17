import express from 'express';
import multer from 'multer';
import { generationConfig } from './config/generationConfig.js';
import { createConfigRouter } from './routes/config.js';
import { createGenerationsRouter } from './routes/generations.js';
import { createHealthRouter } from './routes/health.js';
import { createTemplatesRouter } from './routes/templates.js';
import { createOpenRouterSecretsRouter } from './routes/openrouterSecrets.js';
import { createResultsRouter } from './routes/results.js';
import { createGenerationService } from './services/generateImage.js';
import { createGenerationExecutor } from './services/generationExecutor.js';
import { createGenerationCoordinator } from './services/generationCoordinator.js';
import { createBatchService } from './services/batchService.js';
import { createBatchQueue } from './services/batchQueue.js';
import { createLocalBatchRepository } from './repositories/localBatchRepository.js';
import { createBatchesRouter } from './routes/batches.js';
import { createLocalResultStorage } from './storage/localResultStorage.js';
import { createLocalTemplateRepository } from './repositories/localTemplateRepository.js';
import { createTemplateService } from './services/templateService.js';
import { createResultService } from './services/resultService.js';
import { createLocalBrandingStorage } from './storage/localBrandingStorage.js';
import { createBrandingService } from './services/brandingService.js';
import { createBrandingRouter } from './routes/branding.js';
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
  resultService,
  templateRepository,
  templateService,
  generationService,
  generateImage,
  generationCoordinator,
  generationExecutor,
  batchRepository,
  batchService,
  batchQueue,
  brandingStorage = createLocalBrandingStorage(),
  brandingService,
} = {}) {
  let resolvedGenerationService;
  const resolvedCoordinator = generationCoordinator || createGenerationCoordinator();
  const resolvedTemplateRepository = templateRepository || createLocalTemplateRepository();
  const resolvedTemplateService = templateService || createTemplateService({
    repository: resolvedTemplateRepository,
    isGenerationActive: () => resolvedCoordinator.isBusy(),
  });
  const resolvedBrandingService = brandingService || createBrandingService({ storage: brandingStorage });
  const resolvedExecutor = generationExecutor || createGenerationExecutor({ openRouterClient, resultStorage, templateService: resolvedTemplateService, brandingService: resolvedBrandingService });
  resolvedGenerationService = generationService || (generateImage ? { generate: generateImage, isBusy: () => resolvedCoordinator.isBusy() } : createGenerationService({
    executor: resolvedExecutor,
    coordinator: resolvedCoordinator,
    openRouterClient,
    resultStorage,
    templateService: resolvedTemplateService,
  }));
  const resolvedBatchRepository = batchRepository || createLocalBatchRepository();
  const resolvedBatchService = batchService || createBatchService({ repository: resolvedBatchRepository, templateService: resolvedTemplateService });
  const resolvedBatchQueue = batchQueue || createBatchQueue({ batchService: resolvedBatchService, executor: resolvedExecutor, coordinator: resolvedCoordinator });
  resolvedBatchRepository.ensureInitialized().catch((error) => console.error('[batches]', error?.message || error));
  const resolvedResultService = resultService || createResultService({ storage: resultStorage, templateService: resolvedTemplateService, brandingService: resolvedBrandingService });
  const app = express();
  app.disable('x-powered-by');
  app.use(requestLogger);
  app.use(express.json({ limit: '16kb' }));
  app.use('/api/health', createHealthRouter({ keyResolver }));
  app.use('/api/config', createConfigRouter({ keyResolver }));
  app.use('/api/secrets/openrouter', createOpenRouterSecretsRouter({ keyStore, keyResolver, keyValidator }));
  app.use('/api/templates', createTemplatesRouter({ templateService: resolvedTemplateService }));
  app.use('/api/generations', createGenerationsRouter({ generationService: resolvedGenerationService }));
  app.use('/api/batches', createBatchesRouter({ batchService: resolvedBatchService, repository: resolvedBatchRepository }));
  app.use('/api/results', createResultsRouter({ resultService: resolvedResultService }));
  app.use('/api/branding', createBrandingRouter({ brandingService: resolvedBrandingService }));

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
