// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createLocalAiSettingsRepository } from '../../server/repositories/localAiSettingsRepository.js';

const directories = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

describe('local AI settings repository', () => {
  it('persists only safe metadata and keeps a valid backup', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'prime-ai-settings-'));
    directories.push(directory);
    const repository = createLocalAiSettingsRepository({ settingsDir: directory });
    await repository.ensureInitialized();
    await repository.update('deepseek', (current) => ({ ...current, lastTestedAt: '2026-07-21T20:00:00.000Z', lastTestStatus: 'success' }));
    const primary = JSON.parse(await readFile(repository.paths.filePath, 'utf8'));
    const backup = JSON.parse(await readFile(repository.paths.backupPath, 'utf8'));
    expect(primary.providers.find((item) => item.provider === 'deepseek')).toMatchObject({ modelId: 'deepseek-v4-flash', lastTestStatus: 'success' });
    expect(backup.schemaVersion).toBe(1);
    expect(JSON.stringify(primary)).not.toMatch(/apiKey|secret|configured|base64|week\.json/i);
  });

  it('migrates the previous deepseek-chat default to deepseek-v4-flash', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'prime-ai-settings-'));
    directories.push(directory);
    await mkdir(directory, { recursive: true });
    const legacy = { schemaVersion: 1, providers: [{ provider: 'deepseek', modelId: 'deepseek-chat', lastTestedAt: null, lastTestStatus: 'never' }] };
    await writeFile(path.join(directory, 'ai-providers.json'), JSON.stringify(legacy));
    await writeFile(path.join(directory, 'ai-providers.json.bak'), JSON.stringify(legacy));
    const repository = createLocalAiSettingsRepository({ settingsDir: directory });
    await expect(repository.get('deepseek')).resolves.toMatchObject({ modelId: 'deepseek-v4-flash' });
    const migrated = JSON.parse(await readFile(repository.paths.filePath, 'utf8'));
    expect(migrated.providers[0].modelId).toBe('deepseek-v4-flash');
  });
});
