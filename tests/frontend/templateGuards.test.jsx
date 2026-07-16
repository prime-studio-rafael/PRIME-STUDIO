/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchConfig: vi.fn(),
  fetchTemplates: vi.fn(),
  generateImage: vi.fn(),
}));

vi.mock('../../src/features/generation/api/generationClient.js', () => mocks);

import App from '../../src/app/App.jsx';
import { createJpegFile, mockImageBitmap } from './testImages.js';

const configured = {
  keyConfigured: true,
  model: { id: 'nano-banana-lite', label: 'Nano Banana Lite', providerModel: 'google/gemini-3.1-flash-lite-image' },
  fixedGeneration: { resolution: '1K', aspectRatio: '1:1' },
  clothingScope: 'Roupas superiores',
};

beforeEach(() => {
  mocks.fetchConfig.mockResolvedValue(configured);
  mocks.generateImage.mockReset();
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:prime-studio-test');
  globalThis.URL.revokeObjectURL = vi.fn();
  mockImageBitmap();
});

describe('template generation guard', () => {
  it('keeps generation blocked when the selected template is invalid', async () => {
    mocks.fetchTemplates.mockResolvedValue([{
      id: 'model-01',
      label: 'Modelo base 01',
      publicUrl: '/templates/model-01.webp',
      valid: false,
      exists: false,
      validationError: 'Template não encontrado no caminho local.',
    }]);

    const { container } = render(<App />);
    const generateButton = await screen.findByRole('button', { name: 'Gerar imagem' });
    const fileInput = container.querySelector('input[type="file"]');

    fireEvent.change(fileInput, { target: { files: [createJpegFile()] } });
    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(screen.getByTestId('garment-assessment')).toBeInTheDocument());

    expect(screen.getByText('Template indisponível')).toBeInTheDocument();
    expect(generateButton).toBeDisabled();
    expect(mocks.generateImage).not.toHaveBeenCalled();
  });

  it('does not call the generation client when the key is not configured', async () => {
    mocks.fetchConfig.mockResolvedValue({ ...configured, keyConfigured: false });
    mocks.fetchTemplates.mockResolvedValue([{
      id: 'model-01',
      label: 'Modelo base 01',
      publicUrl: '/templates/model-01.jpeg',
      valid: true,
      mimeType: 'image/jpeg',
      sizeBytes: 100,
    }]);

    const { container } = render(<App />);
    const generateButton = await screen.findByRole('button', { name: 'Gerar imagem' });
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [createJpegFile()] } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(generateButton);

    expect(generateButton).toBeDisabled();
    expect(mocks.generateImage).not.toHaveBeenCalled();
  });
});
