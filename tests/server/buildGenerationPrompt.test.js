import { describe, expect, it } from 'vitest';
import { buildGenerationPrompt } from '../../server/prompts/buildGenerationPrompt.js';

const templatePrompt = 'Edite exclusivamente o item-alvo desta categoria.';
const globalRules = 'REGRA UM\nTexto universal.\n\nREGRA DOIS\nOutro texto universal.';

describe('buildGenerationPrompt', () => {
  it('combines templatePrompt and globalRules with a blank line between them', () => {
    const prompt = buildGenerationPrompt({ templatePrompt, globalRules });
    expect(prompt).toBe(`${templatePrompt}\n\n${globalRules}`);
  });

  it('appends a delimited negativePrompt section only when present', () => {
    const withNegative = buildGenerationPrompt({ templatePrompt, globalRules, negativePrompt: 'Não incluir X.' });
    expect(withNegative).toContain('--- PROMPT NEGATIVO ---\nNão incluir X.');
    const withoutNegative = buildGenerationPrompt({ templatePrompt, globalRules, negativePrompt: '   ' });
    expect(withoutNegative).not.toContain('PROMPT NEGATIVO');
  });

  it('appends a delimited additionalInstruction section only when present, always last', () => {
    const prompt = buildGenerationPrompt({ templatePrompt, globalRules, negativePrompt: 'Não incluir X.', additionalInstruction: 'Instrução extra.' });
    expect(prompt).toContain('--- INSTRUÇÃO ADICIONAL DESTA GERAÇÃO ---\nInstrução extra.');
    expect(prompt.indexOf('INSTRUÇÃO ADICIONAL')).toBeGreaterThan(prompt.indexOf('PROMPT NEGATIVO'));
    const withoutInstruction = buildGenerationPrompt({ templatePrompt, globalRules, additionalInstruction: '' });
    expect(withoutInstruction).not.toContain('INSTRUÇÃO ADICIONAL');
  });

  it('normalizes excess blank lines within each section', () => {
    const prompt = buildGenerationPrompt({ templatePrompt: 'Linha 1.\n\n\n\nLinha 2.', globalRules });
    expect(prompt).toContain('Linha 1.\n\nLinha 2.');
    expect(prompt).not.toMatch(/\n{3,}/);
  });

  it('rejects an empty templatePrompt or globalRules', () => {
    expect(() => buildGenerationPrompt({ templatePrompt: '   ', globalRules })).toThrow();
    expect(() => buildGenerationPrompt({ templatePrompt, globalRules: '' })).toThrow();
  });
});
