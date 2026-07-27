/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchOpenRouterKeyStatus: vi.fn(),
  saveOpenRouterKey: vi.fn(),
  deleteOpenRouterKey: vi.fn(),
  testOpenRouterKey: vi.fn(),
  fetchAiProviders: vi.fn(),
}));

vi.mock('../../src/features/settings/api/openRouterSettingsClient.js', () => mocks);
vi.mock('../../src/features/settings/api/aiSettingsClient.js', () => ({
  fetchAiProviders: mocks.fetchAiProviders,
  saveDeepSeekKey: vi.fn(),
  removeDeepSeekKey: vi.fn(),
  testDeepSeekKey: vi.fn(),
  updateDeepSeekSettings: vi.fn(),
}));

import OpenRouterSettingsModal from '../../src/features/settings/components/OpenRouterSettingsModal.jsx';

function Harness() {
  const [configured, setConfigured] = useState(false);
  return (
    <>
      <span>{configured ? 'Sidebar: Chave configurada' : 'Sidebar: Chave não configurada'}</span>
      <OpenRouterSettingsModal open onClose={() => {}} onStatusChange={(status) => setConfigured(status.configured)} />
    </>
  );
}

beforeEach(() => {
  mocks.fetchOpenRouterKeyStatus.mockReset();
  mocks.saveOpenRouterKey.mockReset();
  mocks.deleteOpenRouterKey.mockReset();
  mocks.testOpenRouterKey.mockReset();
  mocks.fetchAiProviders.mockReset();
  mocks.fetchOpenRouterKeyStatus.mockResolvedValue({ configured: false, source: 'none' });
  mocks.fetchAiProviders.mockResolvedValue({ providers: [] });
  globalThis.confirm = vi.fn(() => true);
});

describe('OpenRouter settings interface', () => {
  it('clears the API key field after saving and updates the sidebar status', async () => {
    mocks.saveOpenRouterKey.mockResolvedValue({
      configured: true,
      source: 'keychain',
      message: 'Chave salva com segurança no Chaves do macOS.',
    });

    render(<Harness />);
    fireEvent.click(await screen.findByRole('tab', { name: 'OpenRouter' }));
    const input = await screen.findByLabelText('API Key do OpenRouter');
    fireEvent.change(input, { target: { value: 'secret-only-in-this-test-value' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar chave' }));

    await waitFor(() => expect(input).toHaveValue(''));
    expect(screen.getByText('Sidebar: Chave configurada')).toBeInTheDocument();
    expect(screen.getByText('Chave salva com segurança no Chaves do macOS.')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('secret-only-in-this-test-value')).not.toBeInTheDocument();
  });

  it('shows an invalid key result without starting an image generation', async () => {
    mocks.fetchOpenRouterKeyStatus.mockResolvedValue({ configured: true, source: 'keychain' });
    mocks.testOpenRouterKey.mockResolvedValue({ valid: false, message: 'A chave do OpenRouter não foi aceita.' });

    render(<Harness />);
    fireEvent.click(await screen.findByRole('tab', { name: 'OpenRouter' }));
    const testButton = await screen.findByRole('button', { name: 'Testar conexão' });
    fireEvent.click(testButton);

    expect(await screen.findByText('Chave inválida')).toBeInTheDocument();
    expect(screen.getByText('A chave do OpenRouter não foi aceita.')).toBeInTheDocument();
  });
});
