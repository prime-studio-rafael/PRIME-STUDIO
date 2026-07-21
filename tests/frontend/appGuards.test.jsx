/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import App from '../../src/app/App.jsx';
import { fetchConfig } from '../../src/features/generation/api/generationClient.js';

vi.mock('../../src/features/generation/api/generationClient.js', () => ({
  fetchConfig: vi.fn(async () => ({
    keyConfigured: false,
    model: { id: 'nano-banana-lite', label: 'Nano Banana 2 Lite', providerModel: 'google/gemini-3.1-flash-lite-image' },
    fixedGeneration: { resolution: '1K', aspectRatio: '1:1' },
  })),
  generateImage: vi.fn(),
}));

vi.mock('../../src/features/templates/api/templatesClient.js', () => ({
  fetchTemplates: vi.fn(async () => [{ id: 'model-01', label: 'Modelo base 01', publicUrl: '/templates/model-01.jpeg', valid: true, active: true }]),
  fetchTemplatesPage: vi.fn(async () => ({ templates: [{ id: 'model-01', label: 'Modelo base 01', publicUrl: '/templates/model-01.jpeg', valid: true, active: true }], page: 1, pageSize: 60, total: 1 })),
  fetchTemplateCategories: vi.fn(async () => []),
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  replaceTemplateImage: vi.fn(),
  duplicateTemplate: vi.fn(),
  setTemplateActive: vi.fn(),
  deleteTemplate: vi.fn(),
}));

describe('generation page guards', () => {
  it('keeps the generation button disabled when the key is missing', async () => {
    render(<App />);
    const button = await screen.findByRole('button', { name: 'Gerar imagem' });
    expect(button).toBeDisabled();
  });
});

describe('generation page guards — incomplete Template profile', () => {
  it('blocks generation client-side and shows an explanatory banner when the selected Template has no prompt', async () => {
    fetchConfig.mockResolvedValueOnce({
      keyConfigured: true,
      model: { id: 'nano-banana-lite', label: 'Nano Banana 2 Lite', providerModel: 'google/gemini-3.1-flash-lite-image' },
      fixedGeneration: { resolution: '1K', aspectRatio: '1:1' },
    });
    render(<App />);
    const button = await screen.findByRole('button', { name: 'Gerar imagem' });
    expect(button).toBeDisabled();
    expect(await screen.findByText('Este Template ainda não tem um perfil de geração configurado. Configure o prompt antes de gerar.')).toBeInTheDocument();
  });
});
