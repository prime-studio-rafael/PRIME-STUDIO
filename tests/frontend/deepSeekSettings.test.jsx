/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ save: vi.fn(), remove: vi.fn(), test: vi.fn(), update: vi.fn() }));
vi.mock('../../src/features/settings/api/aiSettingsClient.js', () => ({
  saveDeepSeekKey: mocks.save, removeDeepSeekKey: mocks.remove, testDeepSeekKey: mocks.test, updateDeepSeekSettings: mocks.update,
}));
import DeepSeekSettingsPanel from '../../src/features/settings/components/DeepSeekSettingsPanel.jsx';

const provider = { provider: 'deepseek', configured: false, modelId: 'deepseek-v4-flash', models: [{ id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' }] };

beforeEach(() => { Object.values(mocks).forEach((mock) => mock.mockReset()); globalThis.confirm = vi.fn(() => true); });

describe('DeepSeek settings interface', () => {
  it('keeps the key masked, clears it after saving and never leaves it in the DOM', async () => {
    mocks.save.mockResolvedValue({ ...provider, configured: true, message: 'Chave salva com segurança.' });
    render(<DeepSeekSettingsPanel provider={provider} onChange={() => {}} />);
    const input = screen.getByLabelText('API Key do DeepSeek');
    expect(input).toHaveAttribute('type', 'password');
    fireEvent.change(input, { target: { value: 'deepseek-secret-only-in-test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar chave' }));
    await waitFor(() => expect(input).toHaveValue(''));
    expect(screen.queryByDisplayValue('deepseek-secret-only-in-test')).not.toBeInTheDocument();
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });

  it('shows only deepseek-v4-flash in the model selector', () => {
    render(<DeepSeekSettingsPanel provider={provider} onChange={() => {}} />);
    expect(screen.getByLabelText('Modelo')).toHaveValue('deepseek-v4-flash');
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });
});
