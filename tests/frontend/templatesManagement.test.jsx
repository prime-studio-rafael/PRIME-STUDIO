/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  fetchTemplates: vi.fn(),
  fetchTemplatesPage: vi.fn(),
  fetchTemplateCategories: vi.fn(),
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  replaceTemplateImage: vi.fn(),
  duplicateTemplate: vi.fn(),
  setTemplateActive: vi.fn(),
  deleteTemplate: vi.fn(),
}));

vi.mock('../../src/features/templates/api/templatesClient.js', () => api);
vi.mock('../../src/features/generation/api/generationClient.js', () => ({
  fetchConfig: vi.fn(async () => ({
    keyConfigured: true,
    model: { id: 'nano-banana-lite', label: 'Nano Banana Lite', providerModel: 'google/gemini-3.1-flash-lite-image' },
    fixedGeneration: { resolution: '1K', aspectRatio: '1:1' },
    clothingScope: 'Roupas superiores',
  })),
  generateImage: vi.fn(),
}));

import App from '../../src/app/App.jsx';
import TemplatesPage from '../../src/features/templates/components/TemplatesPage.jsx';
import { imagePolicy } from '../../shared/imagePolicy.js';
import { createJpegFile, mockImageBitmap } from './testImages.js';

const initialTemplates = [
  {
    id: 'model-01', label: 'Modelo base 01', description: 'Campanha principal', publicUrl: '/api/templates/model-01/image?v=1',
    valid: true, active: true, mimeType: 'image/jpeg', realFormat: 'jpeg', width: 773, height: 1024,
    aspectRatio: 773 / 1024, sizeBytes: 77966, qualityLabel: 'Aceitável com aviso', fourByFiveReady: false,
    warnings: [{ code: 'TEMPLATE_RATIO_NOT_4_5', message: 'A proporção está fora da tolerância 4:5.' }],
  },
  {
    id: 'model-02', label: 'Modelo base 02', description: '', publicUrl: '/api/templates/model-02/image?v=1',
    valid: true, active: true, mimeType: 'image/jpeg', realFormat: 'jpeg', width: 773, height: 1024,
    aspectRatio: 773 / 1024, sizeBytes: 77966, qualityLabel: 'Aceitável com aviso', fourByFiveReady: false, warnings: [],
  },
];

let store;

function cloneTemplates() {
  return store.map((template) => ({ ...template, warnings: [...template.warnings] }));
}

beforeEach(() => {
  store = cloneFrom(initialTemplates);
  Object.values(api).forEach((mock) => mock.mockReset());
  api.fetchTemplates.mockImplementation(async () => cloneTemplates());
  api.fetchTemplatesPage.mockImplementation(async ({ page = 1, pageSize = 60, search, category } = {}) => {
    let list = cloneTemplates();
    if (category) list = list.filter((template) => template.category === category);
    if (search) {
      const query = search.toLowerCase();
      list = list.filter((template) => template.label.toLowerCase().includes(query) || (template.tags || []).some((tag) => tag.toLowerCase().includes(query)));
    }
    const total = list.length;
    const start = (page - 1) * pageSize;
    return { templates: list.slice(start, start + pageSize), page, pageSize, total };
  });
  api.fetchTemplateCategories.mockImplementation(async () => [
    { id: 'moda-masculina', label: 'Moda Masculina', emoji: '👕', order: 10 },
    { id: 'moda-feminina', label: 'Moda Feminina', emoji: '👩', order: 20 },
    { id: 'sem-categoria', label: 'Sem categoria', emoji: '📦', order: 999 },
  ]);
  api.createTemplate.mockImplementation(async ({ label, description }) => {
    const template = { ...initialTemplates[0], id: 'created-id', label, description, publicUrl: '/api/templates/created-id/image?v=1' };
    store = [...store, template];
    return template;
  });
  api.updateTemplate.mockImplementation(async (id, data) => {
    store = store.map((template) => template.id === id ? { ...template, ...data } : template);
    return store.find((template) => template.id === id);
  });
  api.replaceTemplateImage.mockImplementation(async (id) => {
    store = store.map((template) => template.id === id ? { ...template, publicUrl: `/api/templates/${id}/image?v=2` } : template);
    return store.find((template) => template.id === id);
  });
  api.duplicateTemplate.mockImplementation(async (id) => {
    const source = store.find((template) => template.id === id);
    const duplicate = { ...source, id: 'duplicate-id', label: `${source.label} — cópia`, publicUrl: '/api/templates/duplicate-id/image?v=1' };
    store = [...store, duplicate];
    return duplicate;
  });
  api.setTemplateActive.mockImplementation(async (id, active) => {
    store = store.map((template) => template.id === id ? { ...template, active } : template);
    return store.find((template) => template.id === id);
  });
  api.deleteTemplate.mockImplementation(async (id) => { store = store.filter((template) => template.id !== id); });
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:template-preview');
  globalThis.URL.revokeObjectURL = vi.fn();
  mockImageBitmap();
});

describe('local template management UI', () => {
  it('opens from the sidebar and renders technical cards, warnings and uncropped previews', async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Templates' }));

    expect(await screen.findByRole('heading', { name: 'Templates' })).toBeInTheDocument();
    expect(screen.getAllByTestId('template-card')).toHaveLength(2);
    expect(screen.getAllByText('773×1024')).toHaveLength(2);
    expect(screen.getByText('A proporção está fora da tolerância 4:5.')).toBeInTheDocument();
    expect(screen.getByAltText('Modelo base 01')).toHaveClass('object-contain');
    expect(container.querySelector('.md\\:grid-cols-2')).toBeInTheDocument();
  });

  it('creates a template only after showing its preview and technical assessment', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Templates' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Novo template' }));
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Modelo editorial' } });
    fireEvent.change(screen.getByLabelText(/Descrição/), { target: { value: 'Fundo neutro' } });
    fireEvent.change(document.querySelector('#template-image-input'), { target: { files: [createJpegFile('modelo.jpeg')] } });

    expect(await screen.findByAltText('Prévia do template')).toHaveClass('object-contain');
    expect(await within(screen.getByRole('dialog')).findByText('Aceitável com aviso')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar template' }));

    await screen.findByText('Template criado com sucesso.');
    expect(api.createTemplate).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Modelo editorial')).toBeInTheDocument();
  });

  it('edits and replaces a template image without changing its id', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Templates' }));
    const firstCard = (await screen.findAllByTestId('template-card'))[0];
    fireEvent.click(within(firstCard).getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Modelo renomeado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar template' }));
    await screen.findByText('Template atualizado com sucesso.');
    expect(api.updateTemplate).toHaveBeenCalledWith('model-01', expect.objectContaining({ label: 'Modelo renomeado' }));

    fireEvent.click(within(screen.getAllByTestId('template-card')[0]).getByRole('button', { name: 'Substituir' }));
    fireEvent.change(document.querySelector('#template-image-input'), { target: { files: [createJpegFile('substituta.jpeg')] } });
    await within(screen.getByRole('dialog')).findByText('Aceitável com aviso');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar template' }));
    await screen.findByText('Imagem substituída com sucesso.');
    expect(api.replaceTemplateImage).toHaveBeenCalledWith('model-01', expect.any(File));
  });

  it('duplicates, deactivates and deletes with explicit confirmation', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Templates' }));
    const firstCard = (await screen.findAllByTestId('template-card'))[0];
    fireEvent.click(within(firstCard).getByRole('button', { name: 'Duplicar' }));
    await screen.findByText('Template duplicado com sucesso.');
    expect(screen.getAllByTestId('template-card')).toHaveLength(3);

    fireEvent.click(within(screen.getAllByTestId('template-card')[0]).getByRole('button', { name: 'Desativar' }));
    await screen.findByText('Template desativado.');
    expect(api.setTemplateActive).toHaveBeenCalledWith('model-01', false);

    const updatedFirstCard = screen.getAllByTestId('template-card')[0];
    fireEvent.click(within(updatedFirstCard).getByRole('button', { name: 'Excluir' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));
    await screen.findByText('Template excluído.');
    expect(api.deleteTemplate).toHaveBeenCalledWith('model-01');
  });

  it('shows empty and API error states', async () => {
    store = [];
    const { unmount } = render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Templates' }));
    expect(await screen.findByText('Nenhum template local')).toBeInTheDocument();
    unmount();

    api.fetchTemplates.mockRejectedValue(new Error('Catálogo indisponível para teste.'));
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Templates' }));
    expect(await screen.findByText('Catálogo indisponível para teste.')).toBeInTheDocument();
  });

  it('blocks every mutation control while a generation is active', async () => {
    const catalog = {
      templates: cloneFrom(initialTemplates), status: 'ready', error: '', mutationPending: false,
      load: vi.fn(), create: vi.fn(), update: vi.fn(), replaceImage: vi.fn(), duplicate: vi.fn(), setActive: vi.fn(), remove: vi.fn(),
    };
    render(<TemplatesPage catalog={catalog} policy={imagePolicy} generationBusy />);
    expect(screen.getByText(/Uma geração está ativa/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo template' })).toBeDisabled();
    const cards = await screen.findAllByTestId('template-card');
    cards.forEach((card) => {
      within(card).getAllByRole('button').forEach((button) => expect(button).toBeDisabled());
    });
  });

  it('reconciles a selected template after it becomes inactive', async () => {
    render(<App />);
    const secondChoice = await screen.findByRole('button', { name: /^Modelo base 02/ });
    fireEvent.click(secondChoice);
    expect(secondChoice).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Templates' }));
    const secondCard = (await screen.findAllByTestId('template-card'))[1];
    fireEvent.click(within(secondCard).getByRole('button', { name: 'Desativar' }));
    await screen.findByText('Template desativado.');
    fireEvent.click(screen.getByRole('button', { name: 'Nova geração' }));

    await waitFor(() => expect(screen.getByRole('button', { name: /^Modelo base 01/ })).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByRole('button', { name: /^Modelo base 02/ })).toBeDisabled();
  });

  it('creates a template with a category and tags, and shows them on the card', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Templates' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Novo template' }));
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Camisa polo' } });
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'moda-masculina' } });
    fireEvent.change(screen.getByLabelText(/Tags/), { target: { value: 'casual, verão' } });
    fireEvent.change(document.querySelector('#template-image-input'), { target: { files: [createJpegFile('modelo.jpeg')] } });
    await within(screen.getByRole('dialog')).findByText('Aceitável com aviso');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar template' }));

    await screen.findByText('Template criado com sucesso.');
    expect(api.createTemplate).toHaveBeenCalledWith(expect.objectContaining({ category: 'moda-masculina', tags: ['casual', 'verão'] }));
  });

  it('filters templates by category using the toolbar chips', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Templates' }));
    await screen.findByRole('heading', { name: 'Templates' });
    fireEvent.click(await screen.findByRole('button', { name: /Moda Masculina/ }));
    expect(await screen.findByText('Nenhum template neste filtro')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Todas' }));
    expect(await screen.findAllByTestId('template-card')).toHaveLength(2);
  });

  it('filters templates by search text', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Templates' }));
    await screen.findAllByTestId('template-card');
    fireEvent.change(screen.getByLabelText('Buscar templates'), { target: { value: 'base 02' } });
    await waitFor(() => expect(screen.getAllByTestId('template-card')).toHaveLength(1));
    expect(screen.getByText('Modelo base 02')).toBeInTheDocument();
  });
});

function cloneFrom(templates) {
  return templates.map((template) => ({ ...template, warnings: [...template.warnings] }));
}

describe('TemplatesPage real pagination', () => {
  function bigCatalog(count) {
    return Array.from({ length: count }, (_, index) => ({
      id: `bulk-${index + 1}`, label: `Template ${index + 1}`, description: '', publicUrl: `/api/templates/bulk-${index + 1}/image`,
      valid: true, active: true, mimeType: 'image/jpeg', realFormat: 'jpeg', width: 773, height: 1024,
      aspectRatio: 773 / 1024, sizeBytes: 77966, qualityLabel: 'Válido', fourByFiveReady: true, warnings: [],
      category: 'sem-categoria', tags: [],
    }));
  }

  beforeEach(() => {
    store = bigCatalog(15);
    api.fetchTemplatesPage.mockImplementation(async ({ page = 1, pageSize = 12, search, category } = {}) => {
      let list = cloneTemplates();
      if (category) list = list.filter((template) => template.category === category);
      if (search) {
        const query = search.toLowerCase();
        list = list.filter((template) => template.label.toLowerCase().includes(query));
      }
      const total = list.length;
      const start = (page - 1) * pageSize;
      return { templates: list.slice(start, start + pageSize), page, pageSize, total };
    });
  });

  it('loads only the first page, then "Carregar mais" appends the next page without duplicating items', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Templates' }));
    await waitFor(() => expect(screen.getAllByTestId('template-card')).toHaveLength(12));

    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));
    await waitFor(() => expect(screen.getAllByTestId('template-card')).toHaveLength(15));
    const ids = screen.getAllByTestId('template-card').map((card) => within(card).getByRole('heading').textContent);
    expect(new Set(ids).size).toBe(15);
  });

  it('hides the "Carregar mais" button once every item is loaded', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Templates' }));
    await waitFor(() => expect(screen.getAllByTestId('template-card')).toHaveLength(12));
    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));
    await waitFor(() => expect(screen.getAllByTestId('template-card')).toHaveLength(15));
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument();
  });

  it('resets to the first page and clears accumulated items when the search text changes', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Templates' }));
    await waitFor(() => expect(screen.getAllByTestId('template-card')).toHaveLength(12));
    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));
    await waitFor(() => expect(screen.getAllByTestId('template-card')).toHaveLength(15));

    fireEvent.change(screen.getByLabelText('Buscar templates'), { target: { value: 'Template 1' } });
    await waitFor(() => {
      const labels = screen.getAllByTestId('template-card').map((card) => within(card).getByRole('heading').textContent);
      expect(labels.every((label) => label.includes('Template 1'))).toBe(true);
    });
  });

  it('preserves earlier pages when "Carregar mais" fails, and surfaces the error', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Templates' }));
    await waitFor(() => expect(screen.getAllByTestId('template-card')).toHaveLength(12));

    api.fetchTemplatesPage.mockRejectedValueOnce(new Error('Falha ao carregar mais templates.'));
    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));
    expect(await screen.findByText('Falha ao carregar mais templates.')).toBeInTheDocument();
    expect(screen.getAllByTestId('template-card')).toHaveLength(12);
  });
});
