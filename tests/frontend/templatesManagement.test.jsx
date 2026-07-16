/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  fetchTemplates: vi.fn(),
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

  it('blocks every mutation control while a generation is active', () => {
    const catalog = {
      templates: cloneFrom(initialTemplates), status: 'ready', error: '', mutationPending: false,
      load: vi.fn(), create: vi.fn(), update: vi.fn(), replaceImage: vi.fn(), duplicate: vi.fn(), setActive: vi.fn(), remove: vi.fn(),
    };
    render(<TemplatesPage catalog={catalog} policy={imagePolicy} generationBusy />);
    expect(screen.getByText(/Uma geração está ativa/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo template' })).toBeDisabled();
    screen.getAllByTestId('template-card').forEach((card) => {
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
});

function cloneFrom(templates) {
  return templates.map((template) => ({ ...template, warnings: [...template.warnings] }));
}
