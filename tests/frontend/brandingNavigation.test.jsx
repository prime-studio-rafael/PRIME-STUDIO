/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import App from '../../src/app/App.jsx';
import * as brandingApi from '../../src/features/branding/api/brandingClient.js';

vi.mock('../../src/features/generation/api/generationClient.js', () => ({ fetchConfig: vi.fn(async () => ({ keyConfigured: true, model: { id: 'nano-banana-lite' }, fixedGeneration: { resolution: '1K', aspectRatio: '1:1' } })), generateImage: vi.fn() }));
vi.mock('../../src/features/templates/api/templatesClient.js', () => ({ fetchTemplates: vi.fn(async () => []), fetchTemplatesPage: vi.fn(async () => ({ templates: [], page: 1, pageSize: 12, total: 0 })), fetchTemplateCategories: vi.fn(async () => []), createTemplate: vi.fn(), updateTemplate: vi.fn(), replaceTemplateImage: vi.fn(), duplicateTemplate: vi.fn(), setTemplateActive: vi.fn(), deleteTemplate: vi.fn() }));
vi.mock('../../src/features/branding/api/brandingClient.js', () => ({
  fetchBrandingState: vi.fn(),
  uploadBrandingLogo: vi.fn(),
  approveBrandingLogo: vi.fn(),
  updateBrandingConfig: vi.fn(),
  deleteBrandingLogo: vi.fn(),
  BRANDING_PENDING_LOGO_URL: '/api/branding/logo?variant=pending',
  BRANDING_APPROVED_LOGO_URL: '/api/branding/logo?variant=approved',
  BRANDING_PREVIEW_ORIGINAL_URL: '/api/branding/preview?variant=original',
  BRANDING_PREVIEW_BRANDED_URL: '/api/branding/preview?variant=branded',
}));

beforeEach(() => {
  brandingApi.fetchBrandingState.mockResolvedValue({ config: { enabled: false }, pending: null, approved: null });
});

describe('Branding as a standalone sidebar view', () => {
  it('opens a full page (not a modal) when clicking "Branding" in the sidebar', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Branding' }));
    expect(await screen.findByRole('heading', { name: 'Branding' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Nenhuma logo enviada ainda')).toBeInTheDocument();
  });

  it('offers a shortcut from Configurações that navigates to the Branding view and closes the modal', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Configurações' }));
    fireEvent.click(await screen.findByRole('tab', { name: 'Branding' }));
    fireEvent.click(await screen.findByRole('button', { name: /Ir para Branding/ }));
    expect(await screen.findByRole('heading', { name: 'Branding' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not render the Branding upload UI inside the Configurações modal anymore', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Configurações' }));
    fireEvent.click(await screen.findByRole('tab', { name: 'Branding' }));
    expect(await screen.findByText('Branding agora tem uma tela própria')).toBeInTheDocument();
    expect(screen.queryByText('Enviar logo (PNG)')).not.toBeInTheDocument();
  });
});
