/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import useGeneration from '../../src/features/generation/hooks/useGeneration.js';
import { createJpegFile } from './testImages.js';

const mockedGenerateImage = vi.fn();
vi.mock('../../src/features/generation/api/generationClient.js', () => ({ generateImage: (...args) => mockedGenerateImage(...args) }));

function Harness() {
  const { generate, reset, status, referenceSnapshot } = useGeneration();
  const input = {
    templateId: 'model-01',
    modelId: 'nano-banana-lite',
    confirmPaid: true,
    garmentFile: createJpegFile(),
    template: { id: 'model-01', label: 'Modelo 01', publicUrl: '/templates/model-01.jpeg', mimeType: 'image/jpeg' },
  };
  return <><button type="button" onClick={() => generate(input)}>Gerar</button><button type="button" onClick={reset}>Resetar</button><span>{status}</span><span data-testid="snapshot-url">{referenceSnapshot?.garment.previewUrl || ''}</span></>;
}

describe('generation hook', () => {
  beforeEach(() => {
    mockedGenerateImage.mockReset();
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:generation-snapshot');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it('ignores a duplicate click while the request is pending', async () => {
    let resolveRequest;
    mockedGenerateImage.mockImplementation(() => new Promise((resolve) => { resolveRequest = resolve; }));
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Gerar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gerar' }));

    expect(mockedGenerateImage).toHaveBeenCalledTimes(1);
    resolveRequest({ image: { dataUrl: 'data:image/png;base64,AA==' }, metrics: {} });
  });

  it('keeps an immutable reference snapshot and releases its Object URL on reset', async () => {
    mockedGenerateImage.mockResolvedValue({ image: { dataUrl: 'data:image/png;base64,AA==' }, metrics: {} });
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Gerar' }));
    expect(await screen.findByText('success')).toBeInTheDocument();
    expect(screen.getByTestId('snapshot-url')).toHaveTextContent('blob:generation-snapshot');

    fireEvent.click(screen.getByRole('button', { name: 'Resetar' }));
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:generation-snapshot');
    expect(screen.getByTestId('snapshot-url')).toBeEmptyDOMElement();
  });
});
