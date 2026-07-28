/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import DashboardPage from '../../src/features/dashboard/components/DashboardPage.jsx';

describe('Dashboard premium mockado', () => {
  it('exibe os blocos premium com dados explicitamente demonstrativos', async () => {
    render(<DashboardPage onNavigate={vi.fn()} usdToBrlRate={5.5} />);
    expect(await screen.findByRole('heading', { name: 'Bom dia, Rafael.' })).toBeInTheDocument();
    expect(screen.getByText('Imagens geradas')).toBeInTheDocument();
    expect(screen.getByText('Custo em dólar')).toBeInTheDocument();
    expect(screen.getByText('Custo total em reais')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*7,87/)).toBeInTheDocument();
    expect(screen.getByText(/Cotação usada: R\$\s*5,50/)).toBeInTheDocument();
    expect(screen.getByText('Produção por dia')).toBeInTheDocument();
    expect(screen.getByText('Produções recentes')).toBeInTheDocument();
    expect(screen.getByText('Estilos visuais')).toBeInTheDocument();
    expect(screen.getByText('Tudo sob controle')).toBeInTheDocument();
    expect(screen.getByText('Insights inteligentes')).toBeInTheDocument();
    expect(screen.getByText(/dados demonstrativos/i)).toBeInTheDocument();
  });

  it('altera apenas a leitura mockada do período e reutiliza a navegação existente', async () => {
    const onNavigate = vi.fn();
    render(<DashboardPage onNavigate={onNavigate} />);
    await screen.findByRole('heading', { name: 'Bom dia, Rafael.' });
    fireEvent.click(screen.getByRole('button', { name: '7 dias' }));
    expect(await screen.findByText('286')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nova Produção' }));
    expect(onNavigate).toHaveBeenCalledWith('generation');
  });

  it('keeps the USD mock intact while recalculating BRL with the configured rate', async () => {
    render(<DashboardPage onNavigate={vi.fn()} usdToBrlRate={5.1234} />);
    await screen.findByRole('heading', { name: 'Bom dia, Rafael.' });
    expect(screen.getByText('$1.43')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*7,33/)).toBeInTheDocument();
  });

  it('keeps the BRL card honest while the local quote is unavailable', async () => {
    render(<DashboardPage onNavigate={vi.fn()} usdToBrlRate={null} quoteStatus="error" />);
    await screen.findByRole('heading', { name: 'Bom dia, Rafael.' });
    expect(screen.getByText('Não informado')).toBeInTheDocument();
    expect(screen.getByText('Não foi possível ler a cotação local')).toBeInTheDocument();
    expect(screen.getByText('$1.43')).toBeInTheDocument();
  });
});
