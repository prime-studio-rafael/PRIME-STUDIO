/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import App from '../../src/app/App.jsx';

vi.mock('../../src/features/generation/api/generationClient.js', () => ({
  fetchConfig: vi.fn(async () => ({
    keyConfigured: false,
    model: { id: 'nano-banana-lite', label: 'Nano Banana 2 Lite', providerModel: 'google/gemini-3.1-flash-lite-image' },
    fixedGeneration: { resolution: '1K', aspectRatio: '1:1' },
  })),
  fetchTemplates: vi.fn(async () => [{ id: 'model-01', label: 'Modelo base 01', publicUrl: '/templates/model-01.jpeg', valid: true }]),
  generateImage: vi.fn(),
}));

describe('generation page guards', () => {
  it('keeps the generation button disabled when the key is missing', async () => {
    render(<App />);
    const button = await screen.findByRole('button', { name: 'Gerar imagem' });
    expect(button).toBeDisabled();
  });
});
