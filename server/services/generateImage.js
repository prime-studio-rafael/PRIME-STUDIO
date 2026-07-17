import { AppError } from '../utils/errors.js';
import { createGenerationExecutor } from './generationExecutor.js';
import { createGenerationCoordinator } from './generationCoordinator.js';

// Adaptador da geração individual sobre o mesmo executor usado pela fila local.
export function createGenerationService({ executor, coordinator, openRouterClient, resultStorage, templateService, config, logger, now, uuid } = {}) {
  const resolvedExecutor = executor || createGenerationExecutor({ openRouterClient, resultStorage, templateService, config, logger, now, uuid });
  const resolvedCoordinator = coordinator || createGenerationCoordinator();

  async function generate({ templateId, modelId, confirmPaid, garmentFile }) {
    if (!confirmPaid) throw new AppError('PAID_CONFIRMATION_REQUIRED', 'Confirme o uso de créditos antes de gerar.', { status: 400 });
    if (templateService?.isBusy?.()) throw new AppError('TEMPLATE_MUTATION_IN_PROGRESS', 'Aguarde a alteração do template terminar antes de gerar.', { status: 409 });
    return resolvedCoordinator.run(() => resolvedExecutor.execute({ templateId, modelId, garmentFile }));
  }
  return Object.freeze({ generate, isBusy: () => resolvedCoordinator.isBusy() });
}
