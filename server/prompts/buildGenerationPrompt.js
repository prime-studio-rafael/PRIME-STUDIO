// Ponto único de montagem do prompt final enviado ao provedor — usado idêntico pela geração
// individual e (quando o snapshot do lote estiver completo, a partir da Fase 3) pelos lotes.
// Nunca duplicar esta função em outro arquivo.
export function buildGenerationPrompt({ templatePrompt, globalRules, negativePrompt, additionalInstruction } = {}) {
  if (!templatePrompt?.trim()) throw new Error('buildGenerationPrompt requires a non-empty templatePrompt.');
  if (!globalRules?.trim()) throw new Error('buildGenerationPrompt requires non-empty globalRules.');

  const sections = [normalize(templatePrompt), normalize(globalRules)];
  if (negativePrompt?.trim()) sections.push(`--- PROMPT NEGATIVO ---\n${normalize(negativePrompt)}`);
  if (additionalInstruction?.trim()) sections.push(`--- INSTRUÇÃO ADICIONAL DESTA GERAÇÃO ---\n${normalize(additionalInstruction)}`);
  return sections.join('\n\n');
}

function normalize(text) {
  return text.trim().replace(/\n{3,}/g, '\n\n');
}
