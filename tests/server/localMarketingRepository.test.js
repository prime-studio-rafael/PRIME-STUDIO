import path from 'node:path';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createLocalMarketingRepository } from '../../server/repositories/localMarketingRepository.js';

let directory;
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); directory = null; });

function week(id = 'week-1') { return { schemaVersion: 1, id, weekStart: '2026-07-20', timezone: 'America/Sao_Paulo', status: 'draft', createdAt: '2026-07-20T10:00:00.000Z', updatedAt: '2026-07-20T10:00:00.000Z', approvedAt: null, stories: [] }; }

describe('localMarketingRepository', () => {
  it('persists weeks, backups and separate source/story assets without absolute paths', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'prime-marketing-'));
    const repository = createLocalMarketingRepository({ marketingDir: directory });
    await repository.create(week());
    await repository.writeAsset('week-1', 'sources', 'story-1.jpg', Buffer.from('source'));
    await repository.writeAsset('week-1', 'stories', 'story-1.webp', Buffer.from('story'));
    const updated = await repository.update('week-1', (current) => ({ ...current, updatedAt: '2026-07-20T11:00:00.000Z' }));
    expect(updated.updatedAt).toContain('11:00');
    expect(await repository.readAsset('week-1', 'sources', 'story-1.jpg')).toEqual(Buffer.from('source'));
    expect(JSON.parse(await readFile(path.join(directory, 'weeks/week-1/week.json.bak'), 'utf8')).id).toBe('week-1');
    expect(await readFile(path.join(directory, 'weeks/week-1/week.json'), 'utf8')).not.toContain(directory);
  });

  it('recovers a corrupt primary from a valid backup and blocks traversal', async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'prime-marketing-'));
    const repository = createLocalMarketingRepository({ marketingDir: directory });
    await repository.create(week());
    await writeFile(path.join(directory, 'weeks/week-1/week.json'), '{broken');
    expect((await repository.get('week-1')).id).toBe('week-1');
    await expect(repository.get('../escape')).rejects.toMatchObject({ code: 'INVALID_MARKETING_ID' });
    await expect(repository.readAsset('week-1', 'sources', '../secret')).rejects.toMatchObject({ code: 'INVALID_MARKETING_ASSET' });
  });
});
