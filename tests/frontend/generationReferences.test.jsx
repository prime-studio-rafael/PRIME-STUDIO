/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchConfig: vi.fn(),
  fetchTemplates: vi.fn(),
  generateImage: vi.fn(),
}));

vi.mock('../../src/features/generation/api/generationClient.js', () => ({
  fetchConfig: mocks.fetchConfig,
  generateImage: mocks.generateImage,
}));

vi.mock('../../src/features/templates/api/templatesClient.js', () => ({
  fetchTemplates: mocks.fetchTemplates,
  fetchTemplatesPage: vi.fn(async () => {
    const templates = await mocks.fetchTemplates();
    return { templates, page: 1, pageSize: 60, total: templates.length };
  }),
  fetchTemplateCategories: vi.fn(async () => []),
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  replaceTemplateImage: vi.fn(),
  duplicateTemplate: vi.fn(),
  setTemplateActive: vi.fn(),
  deleteTemplate: vi.fn(),
}));

import App from '../../src/app/App.jsx';
import { createJpegFile, mockImageBitmap } from './testImages.js';

const result = {
  image: { dataUrl: 'data:image/png;base64,AA==', mimeType: 'image/png', downloadFilename: 'result.png' },
  metrics: { costUsd: 0.034, durationMs: 8000 },
  requestId: 'mock-request',
  localSave: { saved: true, metadataSaved: true },
};

beforeEach(() => {
  mocks.fetchConfig.mockResolvedValue({
    keyConfigured: true,
    model: { id: 'nano-banana-lite', label: 'Nano Banana 2 Lite', providerModel: 'google/gemini-3.1-flash-lite-image' },
    fixedGeneration: { resolution: '1K', aspectRatio: '1:1' },
    clothingScope: 'Roupas superiores',
  });
  mocks.fetchTemplates.mockResolvedValue([
    { id: 'model-01', label: 'Modelo base 01', publicUrl: '/templates/model-01.jpeg', valid: true, active: true, mimeType: 'image/jpeg', realFormat: 'jpeg', width: 773, height: 1024, prompt: 'Prompt de teste.' },
    { id: 'model-02', label: 'Modelo base 02', publicUrl: '/templates/model-02.jpeg', valid: true, active: true, mimeType: 'image/jpeg', realFormat: 'jpeg', width: 773, height: 1024, prompt: 'Prompt de teste.' },
  ]);
  mocks.generateImage.mockReset();
  globalThis.URL.createObjectURL = vi.fn()
    .mockReturnValueOnce('blob:current-preview')
    .mockReturnValueOnce('blob:generation-snapshot')
    .mockReturnValue('blob:next-preview');
  globalThis.URL.revokeObjectURL = vi.fn();
  mockImageBitmap();
});

describe('generation reference integrity', () => {
  it('blocks reference controls while busy and compares against the captured snapshot', async () => {
    let resolveGeneration;
    mocks.generateImage.mockImplementation(() => new Promise((resolve) => { resolveGeneration = resolve; }));
    const { container } = render(<App />);
    const generateButton = await screen.findByRole('button', { name: 'Gerar imagem' });
    const garmentInput = container.querySelector('input[type="file"]');

    fireEvent.change(garmentInput, { target: { files: [createJpegFile()] } });
    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(generateButton).toBeEnabled());
    fireEvent.click(generateButton);

    expect(screen.getByRole('button', { name: /^Modelo base 01/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Modelo base 02/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remover roupa' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Substituir' })).toBeDisabled();
    expect(garmentInput).toBeDisabled();
    expect(generateButton).toBeDisabled();
    expect(mocks.generateImage).toHaveBeenCalledTimes(1);

    resolveGeneration(result);
    const comparisonGarment = await screen.findByAltText('Roupa superior enviada');
    expect(comparisonGarment).toHaveAttribute('src', 'blob:generation-snapshot');
    expect(screen.getAllByAltText('Modelo base 01').at(-1)).toHaveAttribute('src', '/templates/model-01.jpeg');
  });

  it('releases the snapshot URL when the successful flow is reset', async () => {
    mocks.generateImage.mockResolvedValue(result);
    const { container } = render(<App />);
    const generateButton = await screen.findByRole('button', { name: 'Gerar imagem' });
    const garmentInput = container.querySelector('input[type="file"]');

    fireEvent.change(garmentInput, { target: { files: [createJpegFile()] } });
    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(generateButton).toBeEnabled());
    fireEvent.click(generateButton);
    await screen.findByText('Comparação da geração');

    fireEvent.click(screen.getByRole('button', { name: /^Modelo base 02/ }));
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:generation-snapshot');
    expect(screen.queryByText('Comparação da geração')).not.toBeInTheDocument();
  });
});
