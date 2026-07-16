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
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  replaceTemplateImage: vi.fn(),
  duplicateTemplate: vi.fn(),
  setTemplateActive: vi.fn(),
  deleteTemplate: vi.fn(),
}));

import App from '../../src/app/App.jsx';
import ComparisonGrid from '../../src/features/generation/components/ComparisonGrid.jsx';
import { createJpegFile, createTinyPngFile, createWebpFile, mockImageBitmap } from './testImages.js';

const config = {
  keyConfigured: true,
  model: { id: 'nano-banana-lite', label: 'Nano Banana Lite', providerModel: 'google/gemini-3.1-flash-lite-image' },
  fixedGeneration: {
    resolution: '1K',
    aspectRatio: '1:1',
    requestedAspectRatio: '4:5',
    aspectRatioActivation: { status: 'blocked', reason: 'Templates fora da tolerância.' },
  },
  clothingScope: 'Roupas superiores',
};

const templates = [{
  id: 'model-01',
  label: 'Modelo base 01',
  publicUrl: '/templates/model-01.jpeg',
  valid: true,
  mimeType: 'image/jpeg',
  realFormat: 'jpeg',
  width: 773,
  height: 1024,
  sizeBytes: 77966,
  fourByFiveReady: false,
  active: true,
}];

beforeEach(() => {
  mocks.fetchConfig.mockResolvedValue(config);
  mocks.fetchTemplates.mockResolvedValue(templates);
  mocks.generateImage.mockReset();
  globalThis.URL.createObjectURL = vi.fn()
    .mockReturnValueOnce('blob:first')
    .mockReturnValueOnce('blob:second')
    .mockReturnValue('blob:next');
  globalThis.URL.revokeObjectURL = vi.fn();
  mockImageBitmap();
});

describe('garment input quality UX', () => {
  it('shows requirements, real dimensions, format, orientation and an adequate classification', async () => {
    const { container } = render(<App />);
    expect(await screen.findByText('Para melhor fidelidade')).toBeInTheDocument();

    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [createJpegFile()] } });

    const assessment = await screen.findByTestId('garment-assessment');
    expect(assessment).toHaveTextContent('Qualidade técnica: Adequada');
    expect(assessment).toHaveTextContent('773×1024');
    expect(assessment).toHaveTextContent('JPEG');
    expect(assessment).toHaveTextContent('Sem orientação EXIF pendente');
    expect(screen.getByAltText('Preview da roupa enviada')).toHaveClass('object-contain');
  });

  it('keeps a quality warning non-blocking', async () => {
    mockImageBitmap(800, 1000);
    const { container } = render(<App />);
    const generateButton = await screen.findByRole('button', { name: 'Gerar imagem' });

    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [createWebpFile()] } });
    fireEvent.click(screen.getByRole('checkbox'));

    expect(await screen.findByText(/Qualidade técnica: Aceitável com aviso/)).toBeInTheDocument();
    expect(screen.getByText(/compressão forte/)).toBeInTheDocument();
    await waitFor(() => expect(generateButton).toBeEnabled());
    expect(mocks.generateImage).not.toHaveBeenCalled();
  });

  it('blocks generation on insufficient dimensions', async () => {
    mockImageBitmap(1, 1);
    const { container } = render(<App />);
    const generateButton = await screen.findByRole('button', { name: 'Gerar imagem' });

    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [createTinyPngFile()] } });
    fireEvent.click(screen.getByRole('checkbox'));

    expect((await screen.findAllByText(/Dimensões insuficientes/)).length).toBeGreaterThan(0);
    expect(generateButton).toBeDisabled();
    expect(mocks.generateImage).not.toHaveBeenCalled();
  });

  it('releases the previous Object URL when the file changes', async () => {
    const { container } = render(<App />);
    await screen.findByRole('button', { name: 'Gerar imagem' });
    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [createJpegFile('primeira.jpeg')] } });
    await screen.findByText('Qualidade técnica: Adequada');

    fireEvent.change(input, { target: { files: [createJpegFile('segunda.jpeg')] } });
    await screen.findByText('segunda.jpeg');
    await screen.findByText('Qualidade técnica: Adequada');

    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:first');
  });

  it('renders a 4:5 comparison frame without cropping images', () => {
    render(<ComparisonGrid
      template={templates[0]}
      garmentPreviewUrl="blob:garment"
      result={{ image: { dataUrl: 'data:image/png;base64,AA==' } }}
      aspectRatio="4:5"
    />);

    const resultImage = screen.getByAltText('Resultado gerado pela IA');
    expect(resultImage).toHaveClass('object-contain');
    expect(resultImage.parentElement).toHaveStyle({ aspectRatio: '4 / 5' });
  });
});
