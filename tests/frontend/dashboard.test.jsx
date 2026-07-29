/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import DashboardPage, { convertUsdToBrl, getDashboardMetrics, getInsights } from '../../src/features/dashboard/components/DashboardPage.jsx';
import { getApprovalRate, getMarketingDistributions, getModelDistribution, getProductionSeries } from '../../src/features/dashboard/dashboardMetrics.js';

const now = new Date('2026-07-28T15:00:00.000Z');
const results = [
  { id: 'result-1', createdAt: '2026-07-28T14:40:00.000Z', reviewStatus: 'approved', templateLabel: 'Camisa Premium', durationMs: 8400, costUsd: 0.034, model: 'Nano Banana' },
  { id: 'result-2', createdAt: '2026-07-28T13:30:00.000Z', reviewStatus: 'pending', templateLabel: 'Tênis EA7', durationMs: 7600, costUsd: 0.034, model: 'Nano Banana' },
  { id: 'result-3', createdAt: '2026-07-27T14:00:00.000Z', reviewStatus: 'approved', templateLabel: 'Jaqueta Essential', durationMs: 8000, costUsd: 0.034, model: 'Nano Banana' },
];
const batches = [{ id: 'batch-1', name: 'Coleção Alphaville', status: 'running', totalItems: 4, completedItems: 2, failedItems: 0, cancelledItems: 0, interruptedItems: 0, items: [{ status: 'completed' }, { status: 'completed' }, { status: 'queued' }, { status: 'queued' }] }];

describe('Dashboard premium com dados locais', () => {
  it('exibe os blocos premium com métricas de resultados e lotes já existentes', async () => {
    render(<DashboardPage onNavigate={vi.fn()} usdToBrlRate={5.5} results={results} batches={batches} keyConfigured now={now} />);
    expect(await screen.findByRole('heading', { name: 'Bom dia, Rafael.' })).toBeInTheDocument();
    expect(screen.getByText('Imagens geradas')).toBeInTheDocument();
    expect(screen.getByText('Custo em dólar')).toBeInTheDocument();
    expect(screen.getByText('Custo total em reais')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*0,37/)).toBeInTheDocument();
    expect(screen.getByText(/US\$ 1 = R\$\s*5,50/)).toBeInTheDocument();
    expect(screen.getByText('Produção por dia')).toBeInTheDocument();
    expect(screen.getByText('Produções recentes')).toBeInTheDocument();
    expect(screen.getByText('Estilos visuais')).toBeInTheDocument();
    expect(screen.getByText('Saúde da operação')).toBeInTheDocument();
    expect(screen.getByText('Inteligência operacional')).toBeInTheDocument();
    expect(screen.getByText('Camisa Premium')).toBeInTheDocument();
    expect(screen.getByText('Coleção Alphaville')).toBeInTheDocument();
    expect(screen.getByText('Chave local configurada')).toBeInTheDocument();
  });

  it('altera o período de leitura real e reutiliza a navegação existente', async () => {
    const onNavigate = vi.fn();
    render(<DashboardPage onNavigate={onNavigate} results={results} batches={batches} now={now} />);
    await screen.findByRole('heading', { name: 'Bom dia, Rafael.' });
    fireEvent.click(screen.getByRole('button', { name: '7 dias' }));
    expect(await screen.findByText('3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nova Produção' }));
    expect(onNavigate).toHaveBeenCalledWith('generation');
  });

  it('converte o custo USD real com a cotação local configurada', async () => {
    render(<DashboardPage onNavigate={vi.fn()} usdToBrlRate={5.1234} results={results} now={now} />);
    await screen.findByRole('heading', { name: 'Bom dia, Rafael.' });
    expect(screen.getByText('$0.07')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*0,35/)).toBeInTheDocument();
  });

  it('mantém o card BRL honesto quando a cotação local está indisponível', async () => {
    render(<DashboardPage onNavigate={vi.fn()} usdToBrlRate={null} quoteStatus="error" results={results} now={now} />);
    await screen.findByRole('heading', { name: 'Bom dia, Rafael.' });
    expect(screen.getByText('Não foi possível ler a cotação local')).toBeInTheDocument();
    expect(screen.getByText('$0.07')).toBeInTheDocument();
  });

  it('deriva métricas sem uma consulta paralela ou contagem duplicada', () => {
    const metrics = getDashboardMetrics({ results: [...results, results[0]], batches, period: 'Hoje', now });
    expect(metrics.generatedCount).toBe(2);
    expect(metrics.costUsd).toBeCloseTo(0.068);
    expect(metrics.averageDurationMs).toBe(8000);
    expect(metrics.activeBatches).toHaveLength(1);
    expect(metrics.queueItems).toBe(2);
    expect(metrics.recent[0].name).toBe('Camisa Premium');
  });

  it('ignora duração zero ou inválida e mantém custo zero como uma amostra real', () => {
    const metrics = getDashboardMetrics({
      now,
      results: [
        { id: 'a', createdAt: '2026-07-28T14:00:00.000Z', reviewStatus: 'pending', durationMs: 0, costUsd: 0, model: '  Modelo B  ' },
        { id: 'b', createdAt: '2026-07-28T13:00:00.000Z', reviewStatus: 'unknown', durationMs: -2, costUsd: null, model: 'modelo a' },
      ],
    });
    expect(metrics.averageDurationMs).toBeNull();
    expect(metrics.costUsd).toBe(0);
    expect(metrics.costSampleCount).toBe(1);
    expect(metrics.mainModel).toBe('modelo a');
    expect(metrics.pendingResults).toBe(1);
  });

  it('não exibe custo fictício quando nenhum resultado possui custo registrado', async () => {
    render(<DashboardPage onNavigate={vi.fn()} usdToBrlRate={5.5} now={now} results={[{ id: 'legacy', createdAt: '2026-07-28T12:00:00.000Z', reviewStatus: 'pending', durationMs: null, costUsd: null }]} />);
    await screen.findByRole('heading', { name: 'Bom dia, Rafael.' });
    expect(screen.getAllByText('Não informado')).not.toHaveLength(0);
    expect(screen.getAllByText('Sem custos registrados no período')).not.toHaveLength(0);
    expect(screen.getByText('Sem dados suficientes')).toBeInTheDocument();
  });

  it('classifica lotes ativos, concluídos e fila sem estimar ETA', () => {
    const metrics = getDashboardMetrics({
      now,
      batches: [
        { id: 'running', status: 'running', items: [{ status: 'generating' }, { status: 'queued' }] },
        { id: 'ready', status: 'ready', items: [{ status: 'queued' }] },
        { id: 'done', status: 'completed', items: [] },
        { id: 'error-done', status: 'completed_with_errors', items: [] },
        { id: 'cancelled', status: 'cancelled', items: [{ status: 'cancelled' }] },
      ],
    });
    expect(metrics.activeBatches).toHaveLength(2);
    expect(metrics.completedBatches).toHaveLength(2);
    expect(metrics.queueItems).toBe(3);
  });

  it('mantém timeline e insights honestos para dados incompletos e erros locais', async () => {
    const incomplete = [{ id: 'legacy', createdAt: null, reviewStatus: 'unknown', templateLabel: null }];
    const metrics = getDashboardMetrics({ results: incomplete, now });
    expect(metrics.recent[0]).toMatchObject({ name: 'legacy', label: 'Estado não informado', time: 'Data não informada' });
    expect(getInsights(metrics)).toEqual(['Ainda não há dados locais suficientes para gerar insights operacionais.']);
    render(<DashboardPage onNavigate={vi.fn()} now={now} resultsStatus="error" resultsError="Falha local de resultados" batchesStatus="error" batchesError="Falha local de lotes" />);
    await screen.findByRole('heading', { name: 'Bom dia, Rafael.' });
    expect(screen.getByText('Falha local de resultados')).toBeInTheDocument();
    expect(screen.getByText('Falha local de lotes')).toBeInTheDocument();
  });

  it('distingue OpenRouter configurado de um serviço realmente monitorado', async () => {
    render(<DashboardPage onNavigate={vi.fn()} now={now} keyConfigured />);
    await screen.findByRole('heading', { name: 'Bom dia, Rafael.' });
    expect(screen.getByText('Chave local configurada')).toBeInTheDocument();
    expect(screen.queryByText('Online')).not.toBeInTheDocument();
  });

  it('converte apenas o produto USD × cotação e arredonda no valor final', () => {
    expect(convertUsdToBrl(0.034, 5.5)).toBe(0.19);
    expect(convertUsdToBrl(0, 5.5)).toBe(0);
    expect(convertUsdToBrl(0.034, null)).toBeNull();
  });

  it('resume o modelo no card e preserva o identificador técnico no tooltip', async () => {
    const technicalModel = 'google/gemini-3.1-flash-lite-image';
    render(<DashboardPage onNavigate={vi.fn()} now={now} results={[{ id: 'model', createdAt: '2026-07-28T12:00:00.000Z', reviewStatus: 'pending', model: technicalModel, costUsd: 0.034 }]} />);
    await screen.findByRole('heading', { name: 'Bom dia, Rafael.' });
    expect(screen.getAllByText('Gemini 3.1 Flash Lite')).not.toHaveLength(0);
    expect(screen.getAllByTitle(technicalModel)).not.toHaveLength(0);
  });

  it('apresenta a ausência de cotação sem usar o rótulo genérico não informado', async () => {
    render(<DashboardPage onNavigate={vi.fn()} now={now} usdToBrlRate={null} results={results} />);
    await screen.findByRole('heading', { name: 'Bom dia, Rafael.' });
    expect(screen.getByText('Cotação ausente')).toBeInTheDocument();
    expect(screen.getByText('Defina a cotação local em Configurações')).toBeInTheDocument();
    expect(screen.queryByText('Dados demonstrativos')).not.toBeInTheDocument();
    expect(screen.queryByText('Monitoramento futuro')).not.toBeInTheDocument();
  });

  it('calcula série diária única no fuso de São Paulo, sem inserir dados fictícios', () => {
    const series = getProductionSeries({ now: new Date('2026-07-28T02:00:00.000Z'), period: '7 dias', results: [{ id: 'a', createdAt: '2026-07-28T01:30:00.000Z' }, { id: 'a', createdAt: '2026-07-28T01:30:00.000Z' }, { id: 'invalid', createdAt: 'x' }] });
    expect(series.points).toHaveLength(7); expect(series.points.at(-1).value).toBe(1); expect(series.hasData).toBe(true);
  });

  it('normaliza modelos e calcula taxa de aprovação sem pendentes', () => {
    const input = [{ id: 'a', createdAt: '2026-07-28T14:00:00.000Z', model: ' google/gemini-3.1-flash-lite-image ', reviewStatus: 'approved' }, { id: 'b', createdAt: '2026-07-28T13:00:00.000Z', model: 'GOOGLE/GEMINI-3.1-FLASH-LITE-IMAGE', reviewStatus: 'rejected' }, { id: 'c', createdAt: '2026-07-28T12:00:00.000Z', reviewStatus: 'pending' }];
    expect(getModelDistribution({ results: input, now }).items[0]).toMatchObject({ count: 2, label: 'Gemini 3.1 Flash Lite' });
    expect(getApprovalRate({ results: input, now })).toMatchObject({ approved: 1, completed: 2, percentage: 50 });
  });

  it('normaliza Stories legados e separa combinações personalizadas', () => {
    const distribution = getMarketingDistributions([{ stories: [{ storyTemplateId: 'product-highlight' }, { storyTemplateId: 'premium', typographyPreset: 'impacto', logoMode: 'primary', logoSize: 'large' }] }]);
    expect(distribution.styles.items).toEqual([expect.objectContaining({ label: 'Personalizado', count: 2 })]);
    expect(distribution.typography.items).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'Premium' }), expect.objectContaining({ label: 'Impacto' })]));
  });
});
