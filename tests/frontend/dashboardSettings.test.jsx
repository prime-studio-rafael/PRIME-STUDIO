/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock('../../src/features/settings/api/aiSettingsClient.js', () => ({ updateDashboardSettings: mocks.update }));
import DashboardSettingsPanel from '../../src/features/settings/components/DashboardSettingsPanel.jsx';

beforeEach(() => mocks.update.mockReset());

describe('Dashboard exchange-rate settings', () => {
  it('starts with the local BRL default and accepts a pt-BR decimal', () => {
    render(<DashboardSettingsPanel settings={{ usdToBrlRate: 5.5 }} />);
    expect(screen.getByLabelText('Cotação do dólar')).toHaveValue('5,50');
    fireEvent.change(screen.getByLabelText('Cotação do dólar'), { target: { value: '5,4321' } });
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
  });

  it.each(['0', '-1', 'cinco', '5,12345'])('blocks invalid rate %s', (value) => {
    render(<DashboardSettingsPanel settings={{ usdToBrlRate: 5.5 }} />);
    fireEvent.change(screen.getByLabelText('Cotação do dólar'), { target: { value } });
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });

  it('saves and reflects the returned local value', async () => {
    mocks.update.mockResolvedValue({ usdToBrlRate: 5.75 });
    const onChange = vi.fn();
    render(<DashboardSettingsPanel settings={{ usdToBrlRate: 5.5 }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Cotação do dólar'), { target: { value: '5,75' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ usdToBrlRate: 5.75 }));
    expect(mocks.update).toHaveBeenCalledWith(5.75);
  });
});
