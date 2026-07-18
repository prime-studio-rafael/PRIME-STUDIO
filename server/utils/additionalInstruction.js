import { AppError } from './errors.js';

// Regra única, compartilhada pela geração individual e pela criação de lote — nunca duas
// constantes/mensagens diferentes para o mesmo limite.
export const ADDITIONAL_INSTRUCTION_MAX_LENGTH = 500;

// Normaliza (trim) e valida a "Instrução adicional desta geração". Nunca trunca silenciosamente:
// acima do limite é sempre um erro 422 explícito. Retorna `null` para vazio/ausente.
export function normalizeAdditionalInstruction(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (trimmed.length > ADDITIONAL_INSTRUCTION_MAX_LENGTH) {
    throw new AppError('ADDITIONAL_INSTRUCTION_TOO_LONG', `A instrução adicional deve ter no máximo ${ADDITIONAL_INSTRUCTION_MAX_LENGTH} caracteres.`, { status: 422 });
  }
  return trimmed;
}
