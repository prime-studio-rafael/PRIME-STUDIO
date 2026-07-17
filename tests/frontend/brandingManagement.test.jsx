/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BrandingPage from '../../src/features/branding/components/BrandingPage.jsx';
import * as api from '../../src/features/branding/api/brandingClient.js';

vi.mock('../../src/features/branding/api/brandingClient.js', () => ({
  fetchBrandingState: vi.fn(),
  uploadBrandingLogo: vi.fn(),
  approveBrandingLogo: vi.fn(),
  updateBrandingConfig: vi.fn(),
  deleteBrandingLogo: vi.fn(),
  BRANDING_PENDING_LOGO_URL: '/api/branding/logo?variant=pending',
  BRANDING_APPROVED_LOGO_URL: '/api/branding/logo?variant=approved',
}));

const emptyState = { config: { enabled: false }, pending: null, approved: null };
const pendingAdequate = {
  fileName: 'logo.png', mimeType: 'image/png', sizeBytes: 20480, dimensions: { width: 512, height: 512 },
  aspectRatio: 1, hasAlpha: true, opaquePixelRatio: 0.4, transparentPixelRatio: 0.5,
  boundingBox: { x: 100, y: 100, width: 300, height: 300 }, canvasOccupancyRatio: 0.6,
  quality: 'adequate', errors: [], warnings: [], uploadedAt: '2026-01-01T10:00:00.000Z',
};
const pendingInadequate = { ...pendingAdequate, quality: 'inadequate', errors: [{ code: 'LOGO_EMPTY_ART', message: 'A logo está praticamente sem conteúdo visível.' }] };
const pendingWithWarning = { ...pendingAdequate, quality: 'acceptable_with_warning', warnings: [{ code: 'LOGO_SMALL_IN_CANVAS', message: 'A arte ocupa uma fração pequena do canvas.' }] };
const approvedRecord = { ...pendingAdequate, approvedAt: '2026-01-02T10:00:00.000Z' };

function pngFile(name = 'logo.png') { return new File(['fake-png-bytes'], name, { type: 'image/png' }); }

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchBrandingState.mockResolvedValue(emptyState);
});

describe('BrandingPage', () => {
  it('shows a loading state while fetching, then an empty state with no logo', async () => {
    let resolveState;
    api.fetchBrandingState.mockReturnValue(new Promise((resolve) => { resolveState = resolve; }));
    render(<BrandingPage open />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    resolveState(emptyState);
    expect(await screen.findByText('Nenhuma logo enviada ainda')).toBeInTheDocument();
  });

  it('shows a friendly error state with a retry action', async () => {
    api.fetchBrandingState.mockRejectedValueOnce(new Error('Falha ao carregar branding.'));
    render(<BrandingPage open />);
    expect(await screen.findByText('Falha ao carregar branding.')).toBeInTheDocument();
    api.fetchBrandingState.mockResolvedValueOnce(emptyState);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Nenhuma logo enviada ainda')).toBeInTheDocument();
  });

  it('uploads a logo and shows the preview with technical data', async () => {
    api.uploadBrandingLogo.mockResolvedValue(pendingAdequate);
    api.fetchBrandingState.mockResolvedValueOnce(emptyState).mockResolvedValueOnce({ ...emptyState, pending: pendingAdequate });
    render(<BrandingPage open />);
    await screen.findByText('Nenhuma logo enviada ainda');
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [pngFile()] } });
    await waitFor(() => expect(api.uploadBrandingLogo).toHaveBeenCalledWith(expect.any(File)));
    expect(await screen.findByText('Logo enviada, aguardando aprovação')).toBeInTheDocument();
    expect(screen.getByText('512×512 · 20 KB')).toBeInTheDocument();
    expect(screen.getByText('Adequada')).toBeInTheDocument();
  });

  it('shows validation errors and blocks approval for an inadequate logo', async () => {
    api.fetchBrandingState.mockResolvedValue({ ...emptyState, pending: pendingInadequate });
    render(<BrandingPage open />);
    expect(await screen.findByText('Inadequada')).toBeInTheDocument();
    expect(screen.getByText('A logo está praticamente sem conteúdo visível.')).toBeInTheDocument();
    const approveButton = screen.getByRole('button', { name: /Aprovar logo/ });
    expect(approveButton).toBeDisabled();
  });

  it('shows warnings and allows approving a logo that is acceptable with a warning', async () => {
    api.fetchBrandingState.mockResolvedValue({ ...emptyState, pending: pendingWithWarning });
    api.approveBrandingLogo.mockResolvedValue({ ...pendingWithWarning, approvedAt: '2026-01-02T10:00:00.000Z' });
    render(<BrandingPage open />);
    expect(await screen.findByText('Aceitável com aviso')).toBeInTheDocument();
    expect(screen.getByText('A arte ocupa uma fração pequena do canvas.')).toBeInTheDocument();
    const approveButton = screen.getByRole('button', { name: /Aprovar logo/ });
    expect(approveButton).not.toBeDisabled();
  });

  it('approves a pending logo', async () => {
    api.fetchBrandingState.mockResolvedValueOnce({ ...emptyState, pending: pendingAdequate }).mockResolvedValueOnce({ ...emptyState, approved: approvedRecord });
    api.approveBrandingLogo.mockResolvedValue(approvedRecord);
    render(<BrandingPage open />);
    await screen.findByText('Logo enviada, aguardando aprovação');
    fireEvent.click(screen.getByRole('button', { name: /Aprovar logo/ }));
    await waitFor(() => expect(api.approveBrandingLogo).toHaveBeenCalled());
    expect(await screen.findByText('Logo ativa (aprovada)')).toBeInTheDocument();
  });

  it('toggles "Aplicar logo nas imagens" only when a logo is approved', async () => {
    api.fetchBrandingState.mockResolvedValueOnce({ ...emptyState, pending: pendingAdequate });
    render(<BrandingPage open />);
    await screen.findByText('Logo enviada, aguardando aprovação');
    expect(screen.getByLabelText('Aplicar logo nas imagens')).toBeDisabled();
  });

  it('enables the toggle once a logo is approved and persists the change', async () => {
    api.fetchBrandingState.mockResolvedValueOnce({ ...emptyState, approved: approvedRecord }).mockResolvedValueOnce({ config: { enabled: true }, pending: null, approved: approvedRecord });
    api.updateBrandingConfig.mockResolvedValue({ enabled: true });
    render(<BrandingPage open />);
    await screen.findByText('Logo ativa (aprovada)');
    const toggle = screen.getByLabelText('Aplicar logo nas imagens');
    expect(toggle).not.toBeDisabled();
    fireEvent.click(toggle);
    await waitFor(() => expect(api.updateBrandingConfig).toHaveBeenCalledWith(true));
  });

  it('replaces the logo by uploading a new file over an approved one', async () => {
    api.fetchBrandingState.mockResolvedValueOnce({ ...emptyState, approved: approvedRecord });
    api.uploadBrandingLogo.mockResolvedValue(pendingAdequate);
    render(<BrandingPage open />);
    await screen.findByText('Logo ativa (aprovada)');
    expect(screen.getByRole('button', { name: /Enviar outra logo/ })).toBeInTheDocument();
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [pngFile('second.png')] } });
    await waitFor(() => expect(api.uploadBrandingLogo).toHaveBeenCalled());
  });

  it('removes the approved logo', async () => {
    api.fetchBrandingState.mockResolvedValueOnce({ ...emptyState, approved: approvedRecord }).mockResolvedValueOnce(emptyState);
    api.deleteBrandingLogo.mockResolvedValue({ deleted: true });
    render(<BrandingPage open />);
    await screen.findByText('Logo ativa (aprovada)');
    fireEvent.click(screen.getByRole('button', { name: 'Remover logo' }));
    await waitFor(() => expect(api.deleteBrandingLogo).toHaveBeenCalled());
    expect(await screen.findByText('Nenhuma logo enviada ainda')).toBeInTheDocument();
  });

  it('shows a safe error message when the upload is rejected', async () => {
    api.fetchBrandingState.mockResolvedValue(emptyState);
    api.uploadBrandingLogo.mockRejectedValue(new Error('A logo precisa ser um arquivo PNG verdadeiro.'));
    render(<BrandingPage open />);
    await screen.findByText('Nenhuma logo enviada ainda');
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [pngFile()] } });
    expect(await screen.findByText('A logo precisa ser um arquivo PNG verdadeiro.')).toBeInTheDocument();
  });
});
