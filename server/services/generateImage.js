import { AppError } from '../utils/errors.js';
import { normalizeAdditionalInstruction } from '../utils/additionalInstruction.js';
import { createGenerationExecutor } from './generationExecutor.js';
import { createGenerationCoordinator } from './generationCoordinator.js';

// Adaptador da geração individual sobre o mesmo executor usado pela fila local.
export function createGenerationService({ executor, coordinator, openRouterClient, resultStorage, templateService, brandingService, config, logger, now, uuid } = {}) {
  const resolvedExecutor = executor || createGenerationExecutor({ openRouterClient, resultStorage, templateService, brandingService, config, logger, now, uuid });
  const resolvedCoordinator = coordinator || createGenerationCoordinator();

  async function generate({ templateId, modelId, confirmPaid, garmentFile, additionalInstruction }) {
    if (!confirmPaid) throw new AppError('PAID_CONFIRMATION_REQUIRED', 'Confirme o uso de créditos antes de gerar.', { status: 400 });
    if (templateService?.isBusy?.()) throw new AppError('TEMPLATE_MUTATION_IN_PROGRESS', 'Aguarde a alteração do template terminar antes de gerar.', { status: 409 });
    const normalizedInstruction = normalizeAdditionalInstruction(additionalInstruction);
    await assertTemplateGenerationReady(templateId);
    return resolvedCoordinator.run(() => resolvedExecutor.execute({ templateId, modelId, garmentFile, additionalInstruction: normalizedInstruction }));
  }

  // Bloqueia antes do lock global e antes de qualquer chamada ao provider — nenhum crédito é
  // debitado para um Template sem prompt configurado (ver defesa equivalente, mais tardia, em
  // generationExecutor.resolveTemplate()).
  async function assertTemplateGenerationReady(templateId) {
    const { publicTemplate } = await templateService.getForGeneration(templateId);
    if (!publicTemplate.prompt?.trim()) {
      throw new AppError('TEMPLATE_PROFILE_INCOMPLETE', 'Este Template ainda não tem um perfil de geração configurado. Configure o prompt antes de gerar.', { status: 422 });
    }
  }
  return Object.freeze({ generate, isBusy: () => resolvedCoordinator.isBusy() });
}
