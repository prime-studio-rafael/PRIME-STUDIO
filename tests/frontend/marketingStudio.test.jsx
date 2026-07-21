/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import MarketingPage from '../../src/features/marketing/components/MarketingPage.jsx';

const week = { id: 'week-1', weekStart: '2026-07-20', timezone: 'America/Sao_Paulo', status: 'draft', updatedAt: '2026-07-20T12:00:00Z', stories: [] };
function marketing(overrides = {}) { return { layouts: [{ id: 'product-highlight', label: 'Produto em destaque' }, { id: 'minimal', label: 'Minimalista' }, { id: 'offer', label: 'Oferta' }], sources: [{ id: 'result-1', templateLabel: 'Modelo aprovado', productHint: 'Produto aprovado', categoryLabel: 'Moda Masculina', brandedAvailable: true }], weeks: [week], selected: week, status: 'ready', error: '', busy: false, load: vi.fn(), select: vi.fn(async () => {}), createWeek: vi.fn(async () => {}), approveWeek: vi.fn(async () => {}), draftWeek: vi.fn(async () => {}), closeWeek: vi.fn(async () => {}), proposeWeek: vi.fn(async () => {}), removeWeek: vi.fn(async () => {}), addStory: vi.fn(async () => {}), updateStory: vi.fn(async () => {}), removeStory: vi.fn(async () => {}), renderStory: vi.fn(async () => {}), setEditorialStatus: vi.fn(async () => {}), ...overrides }; }

describe('Marketing Studio UI', () => {
  it('creates a planned Story from an approved result using simple controls', () => {
    const state = marketing(); render(<MarketingPage marketing={state}/>);
    fireEvent.change(screen.getByLabelText('Nome ou código do produto'), { target: { value: 'Camisa 01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar à semana' }));
    expect(state.addStory).toHaveBeenCalledWith(expect.objectContaining({ sourceResultId: 'result-1', productLabel: 'Camisa 01', storyTemplateId: 'product-highlight', scheduledDate: '2026-07-20' }));
  });

  it('creates a deterministic proposal request with a marked priority', () => {
    const state = marketing(); render(<MarketingPage marketing={state}/>);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Priorizar Modelo aprovado' }));
    fireEvent.change(screen.getByLabelText('Produto de Modelo aprovado'), { target: { value: 'SKU 100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Montar proposta (1)' }));
    expect(state.proposeWeek).toHaveBeenCalledWith([{ sourceResultId: 'result-1', productLabel: 'SKU 100', priority: true }]);
  });

  it('shows a ready Story without crop and offers local render/download operations', () => {
    const readyStory = { id: 'story-1', sourceResultId: 'result-1', sourceAssetVariant: 'original', productLabel: 'Camisa 01', categoryLabel: 'Moda Masculina', storyTemplateId: 'minimal', scheduledDate: '2026-07-20', scheduledTime: '10:00', order: 1, renderStatus: 'ready', editorialStatus: 'ready', renderedAssetFileName: 'story-1.webp' };
    const state = marketing({ weeks: [{ ...week, stories: [readyStory] }], selected: { ...week, stories: [readyStory] } }); render(<MarketingPage marketing={state}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Stories' }));
    expect(screen.getByAltText('Story de Camisa 01')).toHaveClass('object-contain');
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute('href', '/api/marketing/weeks/week-1/stories/story-1/assets/story');
    fireEvent.click(screen.getByRole('button', { name: 'Renderizar novamente' }));
    expect(state.renderStory).toHaveBeenCalledWith('story-1');
    fireEvent.click(screen.getByRole('button', { name: 'Marcar publicado' }));
    expect(state.setEditorialStatus).toHaveBeenCalledWith('story-1', 'published');
  });

  it('shows categories and editorial totals, and keeps a closed week read-only', () => {
    const story = { id: 'story-1', productLabel: 'Bolsa', categoryLabel: 'Bolsas', scheduledDate: '2026-07-20', scheduledTime: '10:00', order: 1, renderStatus: 'ready', editorialStatus: 'published' };
    const closed = { ...week, status: 'closed', approvedAt: '2026-07-20T12:00:00Z', stories: [story] };
    render(<MarketingPage marketing={marketing({ weeks: [closed], selected: closed })}/>);
    expect(screen.getByText(/Semana encerrada/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar Bolsa/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Histórico' }));
    expect(screen.getByText(/0 planejados · 0 prontos · 1 publicados/)).toBeInTheDocument();
    expect(screen.getByText(/Categorias: Bolsas/)).toBeInTheDocument();
  });

  it('shows the preserved source thumbnail in the Calendar without crop', () => {
    const story = { id: 'story-1', productLabel: 'Bolsa', categoryLabel: 'Bolsas', scheduledDate: '2026-07-20', scheduledTime: '10:00', order: 1, renderStatus: 'pending', editorialStatus: 'planned' };
    const state = marketing({ weeks: [{ ...week, stories: [story] }], selected: { ...week, stories: [story] } });
    render(<MarketingPage marketing={state}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Calendário' }));
    expect(screen.getByAltText('Fonte de Bolsa')).toHaveClass('object-contain');
    expect(screen.getByAltText('Fonte de Bolsa')).toHaveAttribute('src', '/api/marketing/weeks/week-1/stories/story-1/assets/source');
  });

  it('shows only an honest empty source warning when there are no approved results', () => {
    render(<MarketingPage marketing={marketing({ sources: [] })}/>);
    expect(screen.getByText('Aprove um resultado na tela Resultados para começar.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar à semana' })).toBeDisabled();
  });

  it('normalizes optional null fields when editing without emitting controlled-input warnings', () => {
    const editable = { id: 'story-null', sourceResultId: 'result-1', sourceAssetVariant: 'original', productLabel: 'Produto sem opcionais', priceText: null, headline: null, ctaText: null, storyTemplateId: 'minimal', scheduledDate: '2026-07-20', scheduledTime: '10:00', order: 1, renderStatus: 'pending' };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const state = marketing({ weeks: [{ ...week, stories: [editable] }], selected: { ...week, stories: [editable] } });
    render(<MarketingPage marketing={state}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Produto sem opcionais' }));
    expect(screen.getByLabelText('Preço (opcional)')).toHaveValue('');
    expect(screen.getByLabelText('Chamada curta (opcional)')).toHaveValue('');
    expect(screen.getByLabelText('CTA (opcional)')).toHaveValue('');
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
