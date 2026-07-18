import { describe, expect, it } from 'vitest';
import { GLOBAL_GENERATION_RULES, GLOBAL_RULES_VERSION } from '../../server/prompts/globalGenerationRules.js';

const REQUIRED_SECTIONS = [
  'PAPEL DAS IMAGENS',
  'ELEMENTOS IMUTÁVEIS DA IMAGEM 1',
  'REGIÃO EDITÁVEL',
  'FIDELIDADE DO ITEM DE REFERÊNCIA',
  'MARCAS, LOGOS E TEXTOS',
  'OCLUSÕES E INTEGRAÇÃO FÍSICA',
  'REGRA DE INCERTEZA',
  'PROIBIÇÕES FINAIS',
];

// Palavras que amarrariam as regras globais a uma única categoria (moda superior/camiseta) — a
// razão original da falha estrutural (Template "Tenis 9060" recebendo instruções de camiseta).
// As regras globais precisam servir igualmente a tênis, bolsas, relógios, óculos, perfumes,
// mockups e futuras categorias; toda especificidade pertence exclusivamente ao templatePrompt.
const CATEGORY_SPECIFIC_WORDS = /\broupas?\b|\bcamisetas?\b|\bpeça superior\b|\bmoda\b|\bvestir\b|\bvestido\b|\bmanga(s)?\b|\bgola\b|\bpunho(s)?\b/i;

describe('globalGenerationRules', () => {
  it('contains every required section exactly once', () => {
    for (const section of REQUIRED_SECTIONS) {
      expect(GLOBAL_GENERATION_RULES.split(section)).toHaveLength(2);
    }
  });

  it('never mentions clothing/fashion-specific terms — must serve any category', () => {
    expect(GLOBAL_GENERATION_RULES).not.toMatch(CATEGORY_SPECIFIC_WORDS);
  });

  it('preserves the effective guarantees of the previous single prompt as generic statements', () => {
    expect(GLOBAL_GENERATION_RULES).toMatch(/Preserve identidade/);
    expect(GLOBAL_GENERATION_RULES).toMatch(/Não espelhe logos/);
    expect(GLOBAL_GENERATION_RULES).toMatch(/Não invente marcas/);
    expect(GLOBAL_GENERATION_RULES).toMatch(/fotografia original e fisicamente coerente/);
  });

  it('exposes a stable version constant used to compute promptVersion', () => {
    expect(GLOBAL_RULES_VERSION).toBe('global-rules-v1');
  });
});
