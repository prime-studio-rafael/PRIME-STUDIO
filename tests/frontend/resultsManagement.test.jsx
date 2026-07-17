/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../../src/app/App.jsx';
import * as api from '../../src/features/results/api/resultsClient.js';

vi.mock('../../src/features/generation/api/generationClient.js', () => ({ fetchConfig: vi.fn(async () => ({ keyConfigured: false, model: { id: 'nano-banana-lite' }, fixedGeneration: { resolution: '1K', aspectRatio: '1:1' } })), generateImage: vi.fn() }));
vi.mock('../../src/features/templates/api/templatesClient.js', () => ({ fetchTemplates: vi.fn(async () => [{ id: 'model-01', label: 'Modelo 01', publicUrl: '/template.jpg', valid: true, active: true }]), createTemplate: vi.fn(), updateTemplate: vi.fn(), replaceTemplateImage: vi.fn(), duplicateTemplate: vi.fn(), setTemplateActive: vi.fn(), deleteTemplate: vi.fn() }));
vi.mock('../../src/features/results/api/resultsClient.js', () => ({ fetchResults: vi.fn(), fetchResult: vi.fn(), updateResultStatus: vi.fn(), deleteResult: vi.fn() }));

const pending = { id: 'new', createdAt: '2026-01-02T10:00:00.000Z', reviewStatus: 'pending', templateId: 'model-01', templateLabel: 'Modelo 01', model: 'modelo novo', costUsd: 0.034, durationMs: 1200, outputMime: 'image/webp', effectiveAspectRatio: '1:1', assets: { result: '/new/result', template: '/new/template', garment: '/new/garment', currentTemplate: null }, metadata: {} };
const approved = { ...pending, id: 'old', createdAt: '2026-01-01T10:00:00.000Z', reviewStatus: 'approved', templateLabel: 'Modelo antigo', assets: { result: '/old/result', template: null, garment: null, currentTemplate: '/template-current' } };

beforeEach(() => {
  api.fetchResults.mockResolvedValue([pending, approved]);
  api.fetchResult.mockImplementation(async (id) => id === 'new' ? pending : approved);
  api.updateResultStatus.mockImplementation(async (id, reviewStatus) => ({ ...(id === 'new' ? pending : approved), reviewStatus }));
  api.deleteResult.mockResolvedValue({ deleted: true });
});

describe('results page', () => {
  it('is accessible from sidebar, shows ordered cards and four filters', async () => {
    render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Resultados' }));
    expect(await screen.findByRole('heading', { name: 'Resultados' })).toBeInTheDocument();
    expect(screen.getAllByTestId('result-card')).toHaveLength(2);
    expect(screen.getAllByTestId('result-card')[0]).toHaveTextContent('Modelo 01');
    ['Todos', 'Aguardando aprovação', 'Aprovados', 'Reprovados'].forEach((name) => expect(screen.getByRole('button', { name })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Aprovados' })); expect(screen.getAllByTestId('result-card')).toHaveLength(1); expect(screen.getByText('Modelo antigo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reprovados' })); expect(screen.getByText('Nenhum resultado neste filtro')).toBeInTheDocument();
  });

  it('opens detail, compares complete references and approves or rejects', async () => {
    render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Resultados' }));
    fireEvent.click((await screen.findAllByTestId('result-card'))[0].querySelector('button'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByAltText('Resultado gerado pela IA')).toHaveAttribute('src', '/new/result');
    expect(within(dialog).getByAltText('Roupa superior enviada')).toHaveAttribute('src', '/new/garment');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aprovar' })); await waitFor(() => expect(api.updateResultStatus).toHaveBeenCalledWith('new', 'approved'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reprovar' })); await waitFor(() => expect(api.updateResultStatus).toHaveBeenCalledWith('new', 'rejected'));
    expect(within(dialog).getByRole('link', { name: 'Baixar imagem' })).toHaveAttribute('href', '/new/result');
  });

  it('shows honest legacy fallbacks and deletes only after confirmation', async () => {
    render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Resultados' }));
    fireEvent.click((await screen.findAllByTestId('result-card'))[1].querySelector('button'));
    const dialog = await screen.findByRole('dialog'); expect(within(dialog).getAllByText('Referência não disponível para esta geração anterior.')).toHaveLength(2);
    expect(within(dialog).getByText(/template atual correspondente/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir' })); const confirmation = screen.getByRole('alertdialog');
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Excluir' })); await waitFor(() => expect(api.deleteResult).toHaveBeenCalledWith('old'));
  });

  it('shows empty and friendly error states', async () => {
    api.fetchResults.mockResolvedValueOnce([]); const { unmount } = render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Resultados' })); expect(await screen.findByText('Nenhum resultado neste filtro')).toBeInTheDocument(); unmount();
    api.fetchResults.mockRejectedValueOnce(new Error('Histórico indisponível.')); render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Resultados' })); expect(await screen.findByText('Histórico indisponível.')).toBeInTheDocument();
  });
});
