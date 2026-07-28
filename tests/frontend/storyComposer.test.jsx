/** @vitest-environment jsdom */
import { fireEvent, render, screen, within } from '@testing-library/react';
import StoryComposer from '../../src/features/marketing/components/StoryComposer.jsx';

vi.mock('../../src/features/branding/api/brandingClient.js', () => ({
  fetchBrandingState: vi.fn(async () => ({ approved: { id: 'primary' }, variants: { primary: { approved: { id: 'primary' } }, white: { approved: null } } })),
  BRANDING_APPROVED_LOGO_URL: '/api/branding/logo?variant=approved',
  BRANDING_WHITE_LOGO_URL: '/api/branding/logo?variant=white',
}));

const week = { id: 'week-1', weekStart: '2026-07-20', stories: [] };
const sources = [{ id: 'result-1', templateLabel: 'Resultado aprovado', originalPreviewUrl: '/result-1.jpg', brandedPreviewUrl: '/result-1-branded.jpg', brandedAvailable: true }];
const layouts = [
  { id: 'premium', label: 'Premium', description: 'Produto sofisticado, preço e chamada de ação equilibrados.' },
  { id: 'luxury', label: 'Luxury', description: 'Composição escura com marca e preço em destaque.' },
  { id: 'minimal', label: 'Minimal', description: 'Imagem predominante, texto leve e marca discreta.' },
  { id: 'offer', label: 'Offer', description: 'Oferta direta com preço e CTA de alto contraste.' },
  { id: 'editorial', label: 'Editorial', description: 'Imagem vertical com narrativa e composição editorial.' },
];

function renderComposer(overrides = {}) {
  const props = { week, sources, layouts, busy: false, onSave: vi.fn(async () => {}), onGenerate: vi.fn(async () => {}), onCancel: vi.fn(), ...overrides };
  render(<StoryComposer {...props}/>);
  return props;
}

function prepareAssets() {
  fireEvent.load(screen.getByAltText('Imagem selecionada para o Story'));
  fireEvent.load(screen.getByAltText('Logo aprovada'));
}

describe('StoryComposer', () => {
  it('updates the preview locally, changes variants/layouts and never calls an external provider', () => {
    const props = renderComposer();
    prepareAssets();
    fireEvent.change(screen.getByLabelText('Nome ou código do produto'), { target: { value: 'Camisa Prime' } });
    fireEvent.change(screen.getByLabelText('Headline (opcional)'), { target: { value: 'Oferta especial hoje' } });
    fireEvent.change(screen.getByLabelText('Variante'), { target: { value: 'branded' } });
    expect(screen.getByAltText('Imagem selecionada para o Story')).toHaveAttribute('src', '/result-1-branded.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar layout Offer' }));
    expect(screen.getByRole('button', { name: 'Selecionar layout Offer' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Camisa Prime')).toBeInTheDocument();
    expect(props.onSave).not.toHaveBeenCalled();
    expect(props.onGenerate).not.toHaveBeenCalled();
  });

  it('uses visual catalog cards for all five layouts and marks a rendered Story stale after selection', () => {
    const story = { id: 'story-1', sourceResultId: 'result-1', sourceAssetVariant: 'original', productLabel: 'Legado', storyTemplateId: 'premium', scheduledDate: '2026-07-20', scheduledTime: '10:00', order: 1, renderStatus: 'ready' };
    const props = renderComposer({ story });
    for (const label of ['Premium', 'Luxury', 'Minimal', 'Offer', 'Editorial']) expect(screen.getByRole('button', { name: `Selecionar layout ${label}` })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar layout Editorial' }));
    expect(screen.getByRole('button', { name: 'Selecionar layout Editorial' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('O arquivo final está desatualizado até você salvar e gerar novamente.')).toBeInTheDocument();
    expect(props.onSave).not.toHaveBeenCalled();
    expect(props.onGenerate).not.toHaveBeenCalled();
  });

  it('applies a Visual Style locally and derives Personalizado after a manual change', () => {
    const story = { id: 'story-1', sourceResultId: 'result-1', sourceAssetVariant: 'original', productLabel: 'Legado', storyTemplateId: 'premium', typographyPreset: 'premium', logoMode: 'primary', logoSize: 'medium', scheduledDate: '2026-07-20', scheduledTime: '10:00', order: 1, renderStatus: 'ready' };
    const props = renderComposer({ story });
    expect(screen.getByText('Estilo ativo: PRIME Store')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar estilo visual Luxury' }));
    expect(screen.getByLabelText('Estilo tipográfico')).toHaveValue('elegante');
    expect(screen.getByLabelText('Logo')).toHaveValue('white');
    expect(screen.getByLabelText('Tamanho da logo')).toHaveValue('small');
    expect(screen.getByText('Estilo ativo: Luxury')).toBeInTheDocument();
    expect(screen.getByText('O arquivo final está desatualizado até você salvar e gerar novamente.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Tamanho da logo'), { target: { value: 'medium' } });
    expect(screen.getByText('Estilo ativo: Personalizado')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Tamanho da logo'), { target: { value: 'small' } });
    expect(screen.getByText('Estilo ativo: Luxury')).toBeInTheDocument();
    expect(props.onSave).not.toHaveBeenCalled();
    expect(props.onGenerate).not.toHaveBeenCalled();
  });

  it('keeps the existing white-logo block when a Visual Style requires it', () => {
    renderComposer();
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar estilo visual Offer' }));
    expect(screen.getByLabelText('Logo')).toHaveValue('white');
    expect(screen.getByText('Logo branca não configurada. Escolha Automática ou Principal.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerar Story final' })).toBeDisabled();
  });

  it('keeps the CTA centered inside its button in the local preview', () => {
    renderComposer();
    const cta = document.querySelector('[data-field="ctaText"]');
    expect(cta).toHaveStyle({ transform: 'translateX(-50%)', textAlign: 'center' });
    expect(cta.style.left).toMatch(/%$/);
  });

  it('updates the local preview with a closed typography preset and marks an existing Story stale', () => {
    const story = { id: 'story-1', sourceResultId: 'result-1', sourceAssetVariant: 'original', productLabel: 'Legado', priceText: 'R$ 199', headline: 'Novo impacto', ctaText: 'Ver agora', storyTemplateId: 'minimal', scheduledDate: '2026-07-20', scheduledTime: '10:00', order: 1, renderStatus: 'ready' };
    const props = renderComposer({ story });
    fireEvent.change(screen.getByLabelText('Estilo tipográfico'), { target: { value: 'impacto' } });
    expect(screen.getByLabelText('Estilo tipográfico')).toHaveValue('impacto');
    expect(document.querySelector('[data-field="headline"]')).toHaveStyle({ fontFamily: 'Bebas Neue' });
    expect(screen.getByText('O arquivo final está desatualizado até você salvar e gerar novamente.')).toBeInTheDocument();
    expect(props.onSave).not.toHaveBeenCalled();
    expect(props.onGenerate).not.toHaveBeenCalled();
  });

  it.each([
    ['premium', 'Manrope'],
    ['moderno', 'Inter'],
    ['elegante', 'Plus Jakarta Sans'],
    ['impacto', 'Bebas Neue'],
  ])('keeps %s consistent in the preview and full-size modal', (preset, family) => {
    const story = { id: 'story-1', sourceResultId: 'result-1', sourceAssetVariant: 'original', productLabel: 'Legado', priceText: 'R$ 199', headline: 'Novo impacto', subheadline: 'Texto legível', ctaText: 'Ver agora', storyTemplateId: 'minimal', scheduledDate: '2026-07-20', scheduledTime: '10:00', order: 1, renderStatus: 'pending' };
    renderComposer({ story });
    prepareAssets();
    fireEvent.change(screen.getByLabelText('Estilo tipográfico'), { target: { value: preset } });
    expect(document.querySelector('[data-field="headline"]')).toHaveStyle({ fontFamily: family });
    if (preset === 'impacto') {
      expect(document.querySelector('[data-field="priceText"]')).toHaveStyle({ fontFamily: 'Bebas Neue' });
      expect(document.querySelector('[data-field="subheadline"]')).toHaveStyle({ fontFamily: 'Inter' });
      expect(document.querySelector('[data-field="ctaText"]')).toHaveStyle({ fontFamily: 'Inter' });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Ver tamanho real' }));
    expect(within(screen.getByRole('dialog', { name: 'Story em tamanho real' })).getByText('Novo impacto')).toBeInTheDocument();
  });

  it('shows safe-area guidance, counters, warnings and a closable full-size preview', () => {
    const props = renderComposer();
    prepareAssets();
    fireEvent.change(screen.getByLabelText('Headline (opcional)'), { target: { value: 'uma headline muito longa com mais de quatro palavras' } });
    expect(screen.getByLabelText('Headline (opcional)').parentElement).toHaveTextContent('palavras');
    expect(screen.getByRole('alert')).toHaveTextContent('Headline');
    expect(screen.getByRole('button', { name: 'Gerar Story final' })).toBeDisabled();
    expect(screen.getByLabelText('Área segura do Instagram')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver tamanho real' }));
    expect(screen.getByRole('dialog', { name: 'Story em tamanho real' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar tamanho real' }));
    expect(screen.queryByRole('dialog', { name: 'Story em tamanho real' })).not.toBeInTheDocument();
    expect(props.onGenerate).not.toHaveBeenCalled();
  });

  it('keeps a legacy Story editable with empty additive fields and identifies the responsive composer', () => {
    const story = { id: 'story-1', sourceResultId: 'result-1', sourceAssetVariant: 'original', productLabel: 'Legado', priceText: null, headline: null, ctaText: null, scheduledDate: '2026-07-20', scheduledTime: '10:00', order: 1, renderStatus: 'pending' };
    renderComposer({ story });
    expect(screen.getByLabelText('Chamada curta (opcional)')).toHaveValue('');
    expect(screen.getByLabelText('Subheadline (opcional)')).toHaveValue('');
    expect(screen.getByRole('button', { name: /Premium/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Preview do Story').closest('aside')).toHaveClass('xl:sticky');
  });

  it('applies a selected AI suggestion locally and invalidates the prior rendered preview', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ suggestions: [{ calloutText: 'Chegou agora', headline: 'Bolsa Prime', subheadline: 'Estilo para acompanhar você', ctaText: 'Saiba mais' }, { calloutText: 'Novo', headline: 'Outra opção', subheadline: 'Texto seguro para Story', ctaText: 'Ver agora' }, { calloutText: 'Destaque', headline: 'Terceira opção', subheadline: 'Texto seguro e elegante', ctaText: 'Conheça' }] }), { status: 200 }));
    const story = { id: 'story-1', sourceResultId: 'result-1', sourceAssetVariant: 'original', productLabel: 'Legado', priceText: null, headline: null, ctaText: null, storyTemplateId: 'minimal', scheduledDate: '2026-07-20', scheduledTime: '10:00', order: 1, renderStatus: 'ready' };
    renderComposer({ story });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar 3 sugestões' }));
    await screen.findByText('Sugestão 1');
    fireEvent.click(screen.getAllByRole('button', { name: 'Aplicar esta sugestão' })[0]);
    expect(screen.getByLabelText('Headline (opcional)')).toHaveValue('Bolsa Prime');
    expect(screen.queryByAltText('Story final renderizado')).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).typographyPreset).toBe('premium');
    global.fetch = originalFetch;
  });

  it('shows a safe configuration message when the DeepSeek key is absent', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ error: { code: 'DEEPSEEK_NOT_CONFIGURED', message: 'Configure a chave do DeepSeek.' } }), { status: 409 }));
    try {
      renderComposer();
      fireEvent.change(screen.getByLabelText('Nome ou código do produto'), { target: { value: 'Bolsa Prime' } });
      fireEvent.click(screen.getByRole('button', { name: 'Gerar 3 sugestões' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Configure a chave do DeepSeek');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    } finally { global.fetch = originalFetch; }
  });
});
