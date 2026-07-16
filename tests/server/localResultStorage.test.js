// @vitest-environment node
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createLocalResultStorage } from '../../server/storage/localResultStorage.js';
import { validWebpBuffer } from './testServer.js';

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('local result storage', () => {
  it('writes image and metadata atomically without storing base64', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'prime-studio-test-'));
    temporaryDirectories.push(directory);
    const saveResult = createLocalResultStorage({ resultsDirectory: directory });

    const saved = await saveResult({
      fileName: 'prime-ia-studio-test.webp',
      imageBuffer: validWebpBuffer(),
      metadata: { id: 'test-id', costUsd: 0.034 },
    });
    const files = await readdir(directory);
    const metadata = await readFile(join(directory, 'prime-ia-studio-test.json'), 'utf8');

    expect(saved).toMatchObject({ saved: true, metadataSaved: true });
    expect(files).toEqual(expect.arrayContaining(['prime-ia-studio-test.webp', 'prime-ia-studio-test.json']));
    expect(files.some((file) => file.includes('.tmp-'))).toBe(false);
    expect(metadata).toContain('"costUsd": 0.034');
    expect(metadata).not.toContain('base64');
  });
});
