/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import StoryComposer from '../../src/features/marketing/components/StoryComposer.jsx';

const week = { id: 'week-1', weekStart: '2026-07-20', stories: [] };
const sources = [{ id: 'result-1', templateLabel: 'Resultado aprovado', originalPreviewUrl: '/result-1.jpg', brandedPreviewUrl: '/result-1-branded.jpg', brandedAvailable: true }];
const layouts = [
  { id: 'product-highlight', label: 'Produto em destaque', background: '#f4f1eb' },
  { id: 'minimal', label: 'Minimalista', background: '#f8fafc' },
  { id: 'offer', label: 'Oferta', background: '#111827' },
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
    fireEvent.click(screen.getByRole('button', { name: 'Oferta' }));
    expect(screen.getByRole('button', { name: 'Oferta' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Camisa Prime')).toBeInTheDocument();
    expect(props.onSave).not.toHaveBeenCalled();
    expect(props.onGenerate).not.toHaveBeenCalled();
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
    const story = { id: 'story-1', sourceResultId: 'result-1', sourceAssetVariant: 'original', productLabel: 'Legado', priceText: null, headline: null, ctaText: null, storyTemplateId: 'minimal', scheduledDate: '2026-07-20', scheduledTime: '10:00', order: 1, renderStatus: 'pending' };
    renderComposer({ story });
    expect(screen.getByLabelText('Chamada curta (opcional)')).toHaveValue('');
    expect(screen.getByLabelText('Subheadline (opcional)')).toHaveValue('');
    expect(screen.getByText('Preview do Story').closest('aside')).toHaveClass('xl:sticky');
  });
});
