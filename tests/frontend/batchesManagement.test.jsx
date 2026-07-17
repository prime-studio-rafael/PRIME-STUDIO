/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../../src/app/App.jsx';
import * as batchesApi from '../../src/features/batches/api/batchesClient.js';
import * as resultsApi from '../../src/features/results/api/resultsClient.js';
import * as templatesApi from '../../src/features/templates/api/templatesClient.js';

vi.mock('../../src/features/generation/api/generationClient.js', () => ({ fetchConfig: vi.fn(async () => ({ keyConfigured: true, model: { id: 'nano-banana-lite' }, fixedGeneration: { resolution: '1K', aspectRatio: '1:1' } })), generateImage: vi.fn() }));
vi.mock('../../src/features/templates/api/templatesClient.js', () => {
  const fetchTemplates = vi.fn(async () => [{ id: 'model-01', label: 'Modelo 01', publicUrl: '/template.jpg', valid: true, active: true, width: 773, height: 1024, mimeType: 'image/jpeg' }]);
  return {
    fetchTemplates,
    fetchTemplatesPage: vi.fn(async () => {
      const templates = await fetchTemplates();
      return { templates, page: 1, pageSize: 60, total: templates.length };
    }),
    fetchTemplateCategories: vi.fn(async () => []),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    replaceTemplateImage: vi.fn(),
    duplicateTemplate: vi.fn(),
    setTemplateActive: vi.fn(),
    deleteTemplate: vi.fn(),
  };
});
vi.mock('../../src/features/results/api/resultsClient.js', () => ({ fetchResults: vi.fn(async () => []), fetchResult: vi.fn(), updateResultStatus: vi.fn(), deleteResult: vi.fn(), APPROVED_ZIP_DOWNLOAD_URL: '/api/results/download/approved' }));
vi.mock('../../src/features/batches/api/batchesClient.js', () => ({ fetchBatches: vi.fn(), fetchBatch: vi.fn(), batchAction: vi.fn(), createBatch: vi.fn() }));

const batchSummary = { id: 'batch-1', name: 'Lote 01', templateLabel: 'Modelo 01', status: 'running', totalItems: 4, completedItems: 1, failedItems: 1, cancelledItems: 0, interruptedItems: 0, estimatedCostUsd: 0.136, actualCostUsd: 0.07 };
const batchDetail = {
  ...batchSummary,
  items: [
    { id: 'i1', originalFileName: 'a.jpg', garmentMime: 'image/jpeg', garmentDimensions: { width: 800, height: 1000 }, status: 'completed', resultId: 'result-1', costUsd: 0.034, durationMs: 5000, safeError: null },
    { id: 'i2', originalFileName: 'b.jpg', garmentMime: 'image/jpeg', garmentDimensions: { width: 800, height: 1000 }, status: 'generating', resultId: null, costUsd: null, durationMs: null, safeError: null },
    { id: 'i3', originalFileName: 'c.jpg', garmentMime: 'image/jpeg', garmentDimensions: { width: 800, height: 1000 }, status: 'queued', resultId: null, costUsd: null, durationMs: null, safeError: null },
    { id: 'i4', originalFileName: 'd.jpg', garmentMime: 'image/jpeg', garmentDimensions: { width: 800, height: 1000 }, status: 'failed', resultId: null, costUsd: null, durationMs: null, safeError: { code: 'GENERATION_FAILED', message: 'A geração deste item falhou.' } },
  ],
};

async function openBatchesAndSelect() {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Produção em Lotes' }));
  fireEvent.click(await screen.findByText('Lote 01'));
  return screen.findByText('a.jpg');
}

beforeEach(() => {
  vi.clearAllMocks();
  batchesApi.fetchBatches.mockResolvedValue([batchSummary]);
  batchesApi.fetchBatch.mockResolvedValue(batchDetail);
  batchesApi.batchAction.mockResolvedValue({});
  batchesApi.createBatch.mockResolvedValue({});
});

describe('batches page', () => {
  it('renders summary cards derived exclusively from real item states, with no fictitious progress', async () => {
    await openBatchesAndSelect();
    expect(within(screen.getByTestId('summary-total')).getByText('4')).toBeInTheDocument();
    expect(within(screen.getByTestId('summary-completed')).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByTestId('summary-processing')).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByTestId('summary-waiting')).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByTestId('summary-errors')).getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2/4 finalizados')).toBeInTheDocument();
  });

  it('shows a real (non-fictitious) progress bar width matching completed+failed over total', async () => {
    await openBatchesAndSelect();
    const progressLabel = screen.getByText('2/4 finalizados');
    const progressBar = progressLabel.closest('div').nextElementSibling.firstChild;
    expect(progressBar).toHaveStyle({ width: '50%' });
  });

  it('shows the item error message safely for a failed item', async () => {
    await openBatchesAndSelect();
    expect(screen.getByText('A geração deste item falhou.')).toBeInTheDocument();
  });

  it('opens the correct result and preserves the resultId when clicking "Abrir resultado"', async () => {
    resultsApi.fetchResult.mockResolvedValue({ id: 'result-1', createdAt: '2026-01-01T10:00:00.000Z', reviewStatus: 'pending', templateId: 'model-01', templateLabel: 'Modelo 01', model: 'modelo', costUsd: 0.034, durationMs: 5000, outputMime: 'image/webp', effectiveAspectRatio: '1:1', assets: { result: '/result-1/result', template: null, garment: null, currentTemplate: null }, metadata: {} });
    await openBatchesAndSelect();
    fireEvent.click(screen.getByRole('button', { name: /Abrir resultado/ }));
    expect(await screen.findByRole('heading', { name: 'Resultados' })).toBeInTheDocument();
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByAltText('Resultado gerado pela IA')).toHaveAttribute('src', '/result-1/result');
    expect(resultsApi.fetchResult).toHaveBeenCalledWith('result-1');
  });

  it('calls the existing pause handler unchanged when pausing a running batch', async () => {
    await openBatchesAndSelect();
    fireEvent.click(screen.getByRole('button', { name: /Pausar/ }));
    await waitFor(() => expect(batchesApi.batchAction).toHaveBeenCalledWith('batch-1', 'pause', undefined));
  });

  it('calls the existing start handler unchanged when starting a ready batch', async () => {
    batchesApi.fetchBatch.mockResolvedValue({ ...batchDetail, status: 'ready', items: [{ ...batchDetail.items[0] }, { ...batchDetail.items[2] }] });
    batchesApi.fetchBatches.mockResolvedValue([{ ...batchSummary, status: 'ready' }]);
    await openBatchesAndSelect();
    fireEvent.click(screen.getByRole('button', { name: /Iniciar/ }));
    await waitFor(() => expect(batchesApi.batchAction).toHaveBeenCalledWith('batch-1', 'start', { confirmPaid: true }));
  });

  it('requires confirmation before cancelling, then calls the existing cancel handler unchanged', async () => {
    await openBatchesAndSelect();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByText('Cancelar este lote?')).toBeInTheDocument();
    expect(batchesApi.batchAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sim' }));
    await waitFor(() => expect(batchesApi.batchAction).toHaveBeenCalledWith('batch-1', 'cancel', undefined));
  });

  it('shows a premium empty state with a call to action to create the first batch', async () => {
    batchesApi.fetchBatches.mockResolvedValue([]);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Produção em Lotes' }));
    expect(await screen.findByText('Nenhum lote criado ainda')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Criar primeiro lote' }));
    expect(screen.getByRole('button', { name: 'Criar lote para revisão' })).toBeInTheDocument();
  });

  it('shows a loading state while batches are being fetched', async () => {
    let resolveBatches;
    batchesApi.fetchBatches.mockReturnValue(new Promise((resolve) => { resolveBatches = resolve; }));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Produção em Lotes' }));
    expect(await screen.findByText('Atualizando…')).toBeInTheDocument();
    resolveBatches([batchSummary]);
    expect(await screen.findByText('Lote 01')).toBeInTheDocument();
  });

  it('shows a friendly error state when batches fail to load', async () => {
    batchesApi.fetchBatches.mockRejectedValue(new Error('Não foi possível carregar os lotes.'));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Produção em Lotes' }));
    expect(await screen.findByText('Não foi possível carregar os lotes.')).toBeInTheDocument();
  });

  it('shows a placeholder inviting selection when batches exist but none is selected', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Produção em Lotes' }));
    expect(await screen.findByText('Selecione um lote para ver os detalhes')).toBeInTheDocument();
  });

  it('renders item thumbnails with object-contain and no crop, and shows the running indicator in the header', async () => {
    await openBatchesAndSelect();
    const thumbnail = screen.getAllByRole('img').find((img) => img.getAttribute('src')?.includes('/api/batches/batch-1/items/i1/garment'));
    expect(thumbnail).toHaveClass('object-contain');
    expect(screen.getByText('1 em execução')).toBeInTheDocument();
  });

  it('groups templates by category in the "Novo lote" select using optgroup', async () => {
    templatesApi.fetchTemplates.mockResolvedValue([
      { id: 'model-01', label: 'Camisa polo', publicUrl: '/template.jpg', valid: true, active: true, category: 'moda-masculina' },
      { id: 'model-02', label: 'Vestido floral', publicUrl: '/template.jpg', valid: true, active: true, category: 'moda-feminina' },
    ]);
    templatesApi.fetchTemplateCategories.mockResolvedValue([
      { id: 'moda-masculina', label: 'Moda Masculina', emoji: '👕', order: 10 },
      { id: 'moda-feminina', label: 'Moda Feminina', emoji: '👩', order: 20 },
    ]);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Produção em Lotes' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Novo lote' }));
    const select = await screen.findByLabelText('Template');
    const groupLabels = within(select).getAllByRole('group').map((group) => group.getAttribute('label'));
    expect(groupLabels).toEqual(['Moda Masculina', 'Moda Feminina']);
  });
});
