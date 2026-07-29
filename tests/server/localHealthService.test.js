import { describe, expect, it, vi } from 'vitest';
import { createLocalHealthService } from '../../server/services/localHealthService.js';

describe('LocalHealthService', () => {
  it('verifica storage e renderer somente por leitura', async () => {
    const fsImpl = { access: vi.fn(async () => {}), readdir: vi.fn(async () => []) };
    const readFonts = vi.fn(() => '@font-face{}');
    const status = await createLocalHealthService({ fsImpl, sharpImpl: { versions: { sharp: 'test' } }, readFonts, storageRoot: '/safe' }).getStatus();
    expect(status).toEqual({ storage: { status: 'available' }, renderer: { status: 'available' } });
    expect(fsImpl.access).toHaveBeenCalled(); expect(fsImpl.readdir).toHaveBeenCalled(); expect(readFonts).toHaveBeenCalled();
  });

  it('não expõe detalhes internos em uma falha local', async () => {
    const status = await createLocalHealthService({ fsImpl: { access: vi.fn(async () => { const error = new Error('/private/path'); error.code = 'EACCES'; throw error; }), readdir: vi.fn() }, sharpImpl: null, readFonts: vi.fn() }).getStatus();
    expect(status).toEqual({ storage: { status: 'unavailable' }, renderer: { status: 'unavailable' } });
    expect(JSON.stringify(status)).not.toContain('/private/path');
  });
});
