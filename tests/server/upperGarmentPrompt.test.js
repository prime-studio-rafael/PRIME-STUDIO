import { buildUpperGarmentPrompt, UPPER_GARMENT_PROMPT_VERSION } from '../../server/prompts/upperGarmentPrompt.js';

describe('upper garment prompt v2', () => {
  it('exports an explicit version and keeps both image roles unambiguous', () => {
    const prompt = buildUpperGarmentPrompt();

    expect(UPPER_GARMENT_PROMPT_VERSION).toBe('upper-garment-v2');
    expect(prompt).toContain('Versão do prompt: upper-garment-v2');
    expect(prompt).toContain('Imagem 1: fonte imutável');
    expect(prompt).toContain('Imagem 2: única referência visual da roupa');
    expect(prompt).toContain('REGIÃO EDITÁVEL');
    expect(prompt).toContain('REGRA DE INCERTEZA');
    expect(prompt).toContain('não crie membros, dedos ou costuras duplicados');
  });
});
