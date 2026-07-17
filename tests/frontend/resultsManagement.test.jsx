/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../../src/app/App.jsx';
import * as api from '../../src/features/results/api/resultsClient.js';
import * as batchesApi from '../../src/features/batches/api/batchesClient.js';

vi.mock('../../src/features/generation/api/generationClient.js', () => ({ fetchConfig: vi.fn(async () => ({ keyConfigured: false, model: { id: 'nano-banana-lite' }, fixedGeneration: { resolution: '1K', aspectRatio: '1:1' } })), generateImage: vi.fn() }));
vi.mock('../../src/features/templates/api/templatesClient.js', () => ({ fetchTemplates: vi.fn(async () => [{ id: 'model-01', label: 'Modelo 01', publicUrl: '/template.jpg', valid: true, active: true }]), createTemplate: vi.fn(), updateTemplate: vi.fn(), replaceTemplateImage: vi.fn(), duplicateTemplate: vi.fn(), setTemplateActive: vi.fn(), deleteTemplate: vi.fn() }));
vi.mock('../../src/features/results/api/resultsClient.js', () => ({ fetchResults: vi.fn(), fetchResult: vi.fn(), updateResultStatus: vi.fn(), deleteResult: vi.fn(), APPROVED_ZIP_DOWNLOAD_URL: '/api/results/download/approved' }));
vi.mock('../../src/features/batches/api/batchesClient.js', () => ({ fetchBatches: vi.fn(), fetchBatch: vi.fn(), batchAction: vi.fn(), createBatch: vi.fn() }));

const newest = { id: 'new', createdAt: '2026-01-03T10:00:00.000Z', reviewStatus: 'pending', templateId: 'model-01', templateLabel: 'Modelo 01', model: 'modelo novo', costUsd: 0.034, durationMs: 1200, outputMime: 'image/webp', effectiveAspectRatio: '1:1', assets: { result: '/new/result', template: '/new/template', garment: '/new/garment', currentTemplate: null }, metadata: {} };
const middle = { ...newest, id: 'mid', createdAt: '2026-01-02T10:00:00.000Z', templateLabel: 'Modelo intermediário', assets: { result: '/mid/result', template: '/mid/template', garment: '/mid/garment', currentTemplate: null } };
const approved = { ...newest, id: 'old', createdAt: '2026-01-01T10:00:00.000Z', reviewStatus: 'approved', templateLabel: 'Modelo antigo', assets: { result: '/old/result', template: null, garment: null, currentTemplate: '/template-current' } };
const byId = { new: newest, mid: middle, old: approved };

beforeEach(() => {
  api.fetchResults.mockResolvedValue([newest, middle, approved]);
  api.fetchResult.mockImplementation(async (id) => byId[id]);
  api.updateResultStatus.mockImplementation(async (id, reviewStatus) => ({ ...byId[id], reviewStatus }));
  api.deleteResult.mockResolvedValue({ deleted: true });
  batchesApi.fetchBatches.mockResolvedValue([]);
  batchesApi.fetchBatch.mockResolvedValue(null);
  batchesApi.batchAction.mockResolvedValue({});
  batchesApi.createBatch.mockResolvedValue({});
});

describe('results page', () => {
  it('is accessible from sidebar, shows ordered cards and four filters', async () => {
    render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Resultados' }));
    expect(await screen.findByRole('heading', { name: 'Resultados' })).toBeInTheDocument();
    expect(screen.getAllByTestId('result-card')).toHaveLength(3);
    expect(screen.getAllByTestId('result-card')[0]).toHaveTextContent('Modelo 01');
    ['Todos', 'Aguardando aprovação', 'Aprovados', 'Reprovados'].forEach((name) => expect(screen.getByRole('button', { name })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Aprovados' })); expect(screen.getAllByTestId('result-card')).toHaveLength(1); expect(screen.getByText('Modelo antigo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reprovados' })); expect(screen.getByText('Nenhum resultado neste filtro')).toBeInTheDocument();
  });

  it('opens detail and compares complete references', async () => {
    render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Resultados' }));
    fireEvent.click((await screen.findAllByTestId('result-card'))[0].querySelector('button'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByAltText('Resultado gerado pela IA')).toHaveAttribute('src', '/new/result');
    expect(within(dialog).getByAltText('Roupa superior enviada')).toHaveAttribute('src', '/new/garment');
    expect(within(dialog).getByRole('link', { name: 'Baixar imagem' })).toHaveAttribute('href', '/new/result');
  });

  it('advances the modal to the next pending result after approving, following list order', async () => {
    api.fetchResults
      .mockResolvedValueOnce([newest, middle, approved])
      .mockResolvedValueOnce([{ ...newest, reviewStatus: 'approved' }, middle, approved]);
    render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Resultados' }));
    fireEvent.click((await screen.findAllByTestId('result-card'))[0].querySelector('button'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aprovar' }));
    await waitFor(() => expect(api.updateResultStatus).toHaveBeenCalledWith('new', 'approved'));
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByAltText('Resultado gerado pela IA')).toHaveAttribute('src', '/mid/result'));
  });

  it('advances the modal to the next pending result after rejecting', async () => {
    api.fetchResults
      .mockResolvedValueOnce([newest, middle, approved])
      .mockResolvedValueOnce([{ ...newest, reviewStatus: 'rejected' }, middle, approved]);
    render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Resultados' }));
    fireEvent.click((await screen.findAllByTestId('result-card'))[0].querySelector('button'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reprovar' }));
    await waitFor(() => expect(api.updateResultStatus).toHaveBeenCalledWith('new', 'rejected'));
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByAltText('Resultado gerado pela IA')).toHaveAttribute('src', '/mid/result'));
  });

  it('closes the modal and shows a discreet message when the review queue is empty, refreshing cards and filters', async () => {
    api.fetchResults
      .mockResolvedValueOnce([middle, approved])
      .mockResolvedValueOnce([{ ...middle, reviewStatus: 'approved' }, approved]);
    render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Resultados' }));
    fireEvent.click((await screen.findAllByTestId('result-card'))[0].querySelector('button'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aprovar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Revisão concluída. Não há mais resultados pendentes.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aprovados' }));
    expect(screen.getAllByTestId('result-card')).toHaveLength(2);
  });

  it('keeps the modal on the same result and shows an error when persisting the review fails', async () => {
    api.updateResultStatus.mockRejectedValueOnce(new Error('Falha ao salvar localmente.'));
    render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Resultados' }));
    fireEvent.click((await screen.findAllByTestId('result-card'))[0].querySelector('button'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aprovar' }));
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByText('Falha ao salvar localmente.')).toBeInTheDocument());
    expect(within(screen.getByRole('dialog')).getByAltText('Resultado gerado pela IA')).toHaveAttribute('src', '/new/result');
  });

  it('shows honest legacy fallbacks and deletes only after confirmation', async () => {
    render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Resultados' }));
    fireEvent.click((await screen.findAllByTestId('result-card'))[2].querySelector('button'));
    const dialog = await screen.findByRole('dialog'); expect(within(dialog).getAllByText('Referência não disponível para esta geração anterior.')).toHaveLength(2);
    expect(within(dialog).getByText(/template atual correspondente/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir' })); const confirmation = screen.getByRole('alertdialog');
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Excluir' })); await waitFor(() => expect(api.deleteResult).toHaveBeenCalledWith('old'));
  });

  it('shows empty and friendly error states', async () => {
    api.fetchResults.mockResolvedValueOnce([]); const { unmount } = render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Resultados' })); expect(await screen.findByText('Nenhum resultado neste filtro')).toBeInTheDocument(); unmount();
    api.fetchResults.mockRejectedValueOnce(new Error('Histórico indisponível.')); render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Resultados' })); expect(await screen.findByText('Histórico indisponível.')).toBeInTheDocument();
  });

  it('shows a disabled download-all button with no approved results, and an enabled zip link when there are approved results', async () => {
    api.fetchResults.mockResolvedValueOnce([newest, middle]);
    render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Resultados' }));
    await screen.findAllByTestId('result-card');
    fireEvent.click(screen.getByRole('button', { name: 'Aprovados' }));
    const disabledButton = screen.getByRole('button', { name: /Baixar todas as aprovadas/ });
    expect(disabledButton).toBeDisabled();
    expect(disabledButton).toHaveAttribute('title', 'Nenhuma imagem aprovada para baixar.');
  });

  it('shows an enabled zip download link when the approved filter has results', async () => {
    render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Resultados' }));
    await screen.findAllByTestId('result-card');
    fireEvent.click(screen.getByRole('button', { name: 'Aprovados' }));
    const link = screen.getByRole('link', { name: /Baixar todas as aprovadas/ });
    expect(link).toHaveAttribute('href', '/api/results/download/approved');
    expect(link).toHaveAttribute('download');
  });

  it('opens the correct result modal directly from the "Abrir resultado" button in Produção em Lotes', async () => {
    batchesApi.fetchBatches.mockResolvedValue([{ id: 'batch-1', name: 'Lote teste', templateLabel: 'Modelo 01', totalItems: 1, actualCostUsd: 0.034, status: 'completed' }]);
    batchesApi.fetchBatch.mockResolvedValue({
      id: 'batch-1', name: 'Lote teste', templateLabel: 'Modelo 01', status: 'completed', totalItems: 1, completedItems: 1, failedItems: 0, cancelledItems: 0, interruptedItems: 0, estimatedCostUsd: 0.034, actualCostUsd: 0.034,
      items: [{ id: 'item-1', originalFileName: 'roupa.jpg', garmentDimensions: { width: 100, height: 100 }, garmentMime: 'image/jpeg', status: 'completed', resultId: 'new', durationMs: 1200 }],
    });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Produção em Lotes' }));
    fireEvent.click(await screen.findByText('Lote teste'));
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir resultado' }));
    expect(await screen.findByRole('heading', { name: 'Resultados' })).toBeInTheDocument();
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByAltText('Resultado gerado pela IA')).toHaveAttribute('src', '/new/result');
  });

  it('keeps normal navigation to Resultados working after visiting via Produção em Lotes', async () => {
    batchesApi.fetchBatches.mockResolvedValue([{ id: 'batch-1', name: 'Lote teste', templateLabel: 'Modelo 01', totalItems: 1, actualCostUsd: 0.034, status: 'completed' }]);
    batchesApi.fetchBatch.mockResolvedValue({
      id: 'batch-1', name: 'Lote teste', templateLabel: 'Modelo 01', status: 'completed', totalItems: 1, completedItems: 1, failedItems: 0, cancelledItems: 0, interruptedItems: 0, estimatedCostUsd: 0.034, actualCostUsd: 0.034,
      items: [{ id: 'item-1', originalFileName: 'roupa.jpg', garmentDimensions: { width: 100, height: 100 }, garmentMime: 'image/jpeg', status: 'completed', resultId: 'new', durationMs: 1200 }],
    });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Produção em Lotes' }));
    fireEvent.click(await screen.findByText('Lote teste'));
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir resultado' }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    fireEvent.click((await screen.findAllByTestId('result-card'))[1].querySelector('button'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByAltText('Resultado gerado pela IA')).toHaveAttribute('src', '/mid/result');
  });
});
