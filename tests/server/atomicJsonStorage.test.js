// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { writeFileAtomically } from '../../server/utils/atomicJsonStorage.js';

describe('atomic local writes', () => {
  it('renames a complete temporary file into place', async () => {
    const fsImpl = { writeFile: vi.fn(async () => {}), rename: vi.fn(async () => {}), unlink: vi.fn(async () => {}) };
    await writeFileAtomically('/safe/catalog.json', '{}', { fsImpl, uuid: () => 'temporary-id' });

    expect(fsImpl.writeFile).toHaveBeenCalledWith('/safe/catalog.json.temporary-id.tmp', '{}');
    expect(fsImpl.rename).toHaveBeenCalledWith('/safe/catalog.json.temporary-id.tmp', '/safe/catalog.json');
    expect(fsImpl.unlink).not.toHaveBeenCalled();
  });

  it('removes the temporary file and preserves the original error semantics when rename fails', async () => {
    const fsImpl = {
      writeFile: vi.fn(async () => {}),
      rename: vi.fn(async () => { throw new Error('simulated rename failure'); }),
      unlink: vi.fn(async () => {}),
    };

    await expect(writeFileAtomically('/safe/catalog.json', '{}', { fsImpl, uuid: () => 'temporary-id' })).rejects.toMatchObject({ code: 'LOCAL_TEMPLATE_STORAGE_FAILED', status: 500 });
    expect(fsImpl.unlink).toHaveBeenCalledWith('/safe/catalog.json.temporary-id.tmp');
  });
});
