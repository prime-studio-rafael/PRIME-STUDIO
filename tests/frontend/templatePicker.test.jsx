/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchConfig: vi.fn(),
  fetchTemplates: vi.fn(),
  fetchTemplatesPage: vi.fn(),
  fetchTemplateCategories: vi.fn(),
  generateImage: vi.fn(),
}));

vi.mock('../../src/features/generation/api/generationClient.js', () => ({
  fetchConfig: mocks.fetchConfig,
  generateImage: mocks.generateImage,
}));

vi.mock('../../src/features/templates/api/templatesClient.js', () => ({
  fetchTemplates: mocks.fetchTemplates,
  fetchTemplatesPage: mocks.fetchTemplatesPage,
  fetchTemplateCategories: mocks.fetchTemplateCategories,
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  replaceTemplateImage: vi.fn(),
  duplicateTemplate: vi.fn(),
  setTemplateActive: vi.fn(),
  deleteTemplate: vi.fn(),
}));

import App from '../../src/app/App.jsx';
import { mockImageBitmap } from './testImages.js';

const configured = {
  keyConfigured: true,
  model: { id: 'nano-banana-lite', label: 'Nano Banana Lite', providerModel: 'google/gemini-3.1-flash-lite-image' },
  fixedGeneration: { resolution: '1K', aspectRatio: '1:1' },
  clothingScope: 'Roupas superiores',
};

const templates = [
  { id: 'model-01', label: 'Modelo base 01', publicUrl: '/templates/model-01.jpeg', valid: true, active: true, mimeType: 'image/jpeg', category: 'moda-masculina', tags: ['casual'], hoverDescription: 'Ideal para roupas casuais', prompt: 'Prompt de teste.' },
  { id: 'model-02', label: 'Modelo base 02', publicUrl: '/templates/model-02.jpeg', valid: true, active: true, mimeType: 'image/jpeg', category: 'moda-feminina', tags: ['festa'], prompt: 'Prompt de teste.' },
];

beforeEach(() => {
  mocks.fetchConfig.mockResolvedValue(configured);
  mocks.fetchTemplates.mockResolvedValue(templates);
  mocks.fetchTemplatesPage.mockImplementation(async ({ page = 1, pageSize = 8, search, category } = {}) => {
    let list = await mocks.fetchTemplates();
    if (category) list = list.filter((template) => template.category === category);
    if (search) {
      const query = search.toLowerCase();
      list = list.filter((template) => template.label.toLowerCase().includes(query) || (template.tags || []).some((tag) => tag.toLowerCase().includes(query)));
    }
    const total = list.length;
    const start = (page - 1) * pageSize;
    return { templates: list.slice(start, start + pageSize), page, pageSize, total };
  });
  mocks.fetchTemplateCategories.mockResolvedValue([
    { id: 'moda-masculina', label: 'Moda Masculina', emoji: '👕', order: 10 },
    { id: 'moda-feminina', label: 'Moda Feminina', emoji: '👩', order: 20 },
  ]);
  mocks.generateImage.mockReset();
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:prime-studio-test');
  globalThis.URL.revokeObjectURL = vi.fn();
  mockImageBitmap();
});

describe('TemplatePicker library filters', () => {
  it('shows the search and category toolbar when there is more than one template', async () => {
    render(<App />);
    await screen.findByRole('button', { name: /^Modelo base 01/ });
    expect(screen.getByLabelText('Buscar templates')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Moda Masculina/ })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Moda Feminina/ })).toBeInTheDocument();
  });

  it('filters templates by category chip without breaking selection', async () => {
    render(<App />);
    await screen.findByRole('button', { name: /^Modelo base 01/ });
    fireEvent.click(await screen.findByRole('button', { name: /Moda Feminina/ }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Modelo base 01/ })).not.toBeInTheDocument());
    const secondOption = screen.getByRole('button', { name: /^Modelo base 02/ });
    fireEvent.click(secondOption);
    expect(secondOption).toHaveAttribute('aria-pressed', 'true');
  });

  it('filters templates by search text across label and tags', async () => {
    render(<App />);
    await screen.findByRole('button', { name: /^Modelo base 01/ });
    fireEvent.change(screen.getByLabelText('Buscar templates'), { target: { value: 'festa' } });
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Modelo base 01/ })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /^Modelo base 02/ })).toBeInTheDocument();
  });

  it('does not show the toolbar when there is only one template', async () => {
    mocks.fetchTemplates.mockResolvedValue([templates[0]]);
    render(<App />);
    await screen.findByRole('button', { name: /^Modelo base 01/ });
    expect(screen.queryByLabelText('Buscar templates')).not.toBeInTheDocument();
  });

  it('sources the grid from real server-side pagination, not from filtering the full list in the browser', async () => {
    render(<App />);
    await screen.findByRole('button', { name: /^Modelo base 01/ });
    expect(mocks.fetchTemplatesPage).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
  });

  it('loads more templates with "Carregar mais" without losing the current selection', async () => {
    const many = Array.from({ length: 10 }, (_, index) => ({
      id: `bulk-${index + 1}`, label: `Bulk ${String(index + 1).padStart(2, '0')}`, publicUrl: '/templates/model-01.jpeg', valid: true, active: true, mimeType: 'image/jpeg', category: 'moda-masculina', tags: [], prompt: 'Prompt de teste.',
    }));
    mocks.fetchTemplates.mockResolvedValue(many);
    render(<App />);
    const first = await screen.findByRole('button', { name: /^Bulk 01/ });
    fireEvent.click(first);
    expect(first).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(await screen.findByRole('button', { name: 'Carregar mais' }));
    await screen.findByRole('button', { name: /^Bulk 09/ });
    expect(screen.getByRole('button', { name: /^Bulk 01/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
