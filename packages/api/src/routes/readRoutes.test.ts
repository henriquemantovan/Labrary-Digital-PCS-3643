import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { context } from '../test/context.js';
import type { GroupResult, PublicProject } from '../models/readModels.js';
const result: GroupResult = { projectId: 2, groupId: 2, round: 1, expected: 2, received: 1, pending: 1, complete: false, released: false, grade: 8, rubricVersionId: 'r1', criteria: [{ title: 'Circuito', weight: 100, grade: 8, comment: 'Privado' }] };
const publication: PublicProject = { id: 1, title: 'Circuito digital', description: 'Descrição', year: 2026, className: 'T1', category: 'Digital', published: true, materials: [{ versionId: 1, title: 'Vídeo', kind: 'VIDEO', url: '/api/public/materials/1/content' }] };
describe('leituras C3 e C4', () => {
  it('nega anônimo, outros grupos e equipe antes de consultar o provedor', async () => {
    const get = vi.fn().mockResolvedValue(result);
    const c = context({ readProviders: { result: { get } } });
    expect((await request(c.app).get('/api/projects/2/result')).status).toBe(401);
    for (const [user, project] of [[1, 1], [1, 999], [2, 1], [3, 2]]) expect((await c.client(user).get(`/api/projects/${project}/result`)).status).toBe(404);
    expect(get).not.toHaveBeenCalled();
    expect((await c.client(1).get('/api/projects/no/result')).status).toBe(400);
  });
  it('oculta valores bloqueados e apresenta parcial/final somente após liberação', async () => {
    const get = vi.fn().mockResolvedValue(result);
    const c = context({ readProviders: { result: { get } } });
    let r = await c.client(1).get('/api/projects/2/result');
    expect(r.status).toBe(200); expect(r.body.data.grade).toBeNull(); expect(r.body.data.criteria).toEqual([]); expect(r.text).not.toContain('Privado');
    get.mockResolvedValue({ ...result, released: true });
    r = await c.client(1).get('/api/projects/2/result');
    expect(r.body.data.grade).toBe(8); expect(r.body.data.criteria[0].comment).toBe('Privado');
    get.mockResolvedValue({ ...result, released: true, complete: true });
    expect((await c.client(1).get('/api/projects/2/result')).body.data.complete).toBe(true);
    get.mockResolvedValue({ ...result, groupId: 1 }); expect((await c.client(1).get('/api/projects/2/result')).status).toBe(404);
    get.mockResolvedValue({ ...result, projectId: 1 }); expect((await c.client(1).get('/api/projects/2/result')).status).toBe(404);
    get.mockResolvedValue(null); expect((await c.client(1).get('/api/projects/2/result')).status).toBe(503);
  });
  it('não usa fixtures sem produtores configurados', async () => {
    const c = context();
    expect((await c.client(1).get('/api/projects/2/result')).status).toBe(503);
    for (const path of ['/api/public/projects', '/api/public/projects/1']) expect((await request(c.app).get(path)).status).toBe(503);
  });
  it('combina filtros e projeta apenas publicações autorizadas', async () => {
    const p = { ...publication, grade: 9, messages: ['segredo'], storageKey: 'privado', materials: [...publication.materials, { ...publication.materials[0], url: '/api/projects/1/materials' }] };
    const c = context({ readProviders: { publications: { list: async () => [p, { ...publication, id: 2, published: false }], get: async () => p } } });
    const get = (path: string) => request(c.app).get(`/api/public/projects${path}`);
    const r = await get('?title=CIRCUITO&year=2026&className=T1&category=Digital');
    expect(r.status).toBe(200); expect(r.body.data).toHaveLength(1); expect(r.body.data[0].materials).toHaveLength(1);
    expect(r.text).not.toMatch(/storageKey|segredo|grade/);
    expect((await get('')).body.data).toHaveLength(1);
    for (const query of ['title=outro', 'year=2025', 'className=T2', 'category=Outra']) expect((await get(`?${query}`)).body.data).toEqual([]);
    for (const query of ['year=abc', 'unknown=1']) expect((await get(`?${query}`)).status).toBe(400);
    expect((await get('/1')).headers['cache-control']).toBe('no-store');
    p.published = false; expect((await get('/1')).status).toBe(404);
    p.published = true; expect((await get('/2')).status).toBe(404);
  });
  it('nega publicação ausente e ids inválidos', async () => {
    const c = context({ readProviders: { publications: { list: async () => [], get: async () => null } } });
    expect((await request(c.app).get('/api/public/projects/1')).status).toBe(404);
    expect((await request(c.app).get('/api/public/projects/no')).status).toBe(400);
  });
});
