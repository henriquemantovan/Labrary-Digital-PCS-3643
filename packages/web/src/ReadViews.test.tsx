import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, it, expect, vi } from 'vitest';
import { Catalog } from './Catalog';
import { GroupResult } from './GroupResult';
import type { ResultView, PublicProject } from './readApi';
const result: ResultView = { projectId: 2, groupId: 2, round: 1, expected: 2, received: 1, pending: 1, complete: false, released: false, grade: 8, rubricVersionId: 'r1', criteria: [{ title: 'Circuito', weight: 100, grade: 8, comment: 'Comentário liberado' }] };
const publication: PublicProject = { id: 1, title: 'Circuito digital', description: 'Descrição', year: 2026, className: 'T1', category: 'Digital', published: true, materials: [{ versionId: 1, title: 'Vídeo', kind: 'VIDEO', url: '/api/public/materials/1/content' }, { versionId: 2, title: 'Manual', kind: 'MANUAL', url: '/api/public/materials/2/content' }] };
function mock(data: unknown, status = 200) { return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(status === 200 ? { data } : { error: { message: 'Indisponível' } }), { status })); }
afterEach(() => vi.restoreAllMocks());
it('resultado bloqueado nunca renderiza notas ou comentários recebidos', async () => {
  mock(result); render(<GroupResult projectId={2} expired={vi.fn()} />);
  expect(screen.getByRole('status').textContent).toContain('Carregando');
  expect(await screen.findByText(/Resultado bloqueado/)).not.toBeNull();
  expect(screen.queryByText('Comentário liberado')).toBeNull(); expect(screen.queryByText(/Nota:/)).toBeNull();
});
it.each([false, true])('exibe resultado liberado e rubrica; completo=%s', async complete => {
  mock({ ...result, released: true, complete }); render(<GroupResult projectId={2} expired={vi.fn()} />);
  expect(await screen.findByText(complete ? 'Resultado liberado' : 'Resultado parcial')).not.toBeNull();
  expect(screen.getByText('Nota: 8.00')).not.toBeNull(); expect(screen.getByText('Comentário liberado')).not.toBeNull();
});
it('distingue pendência de zero e permite repetir erro', async () => {
  const fetch = mock(null, 503); render(<GroupResult projectId={2} expired={vi.fn()} />);
  expect((await screen.findByRole('alert')).textContent).toContain('Indisponível');
  fetch.mockResolvedValue(new Response(JSON.stringify({ data: { ...result, released: true, grade: null, criteria: [{ ...result.criteria[0], grade: null }] } })));
  await userEvent.click(screen.getByText('Tentar novamente')); expect(await screen.findByText('Nota: Pendente')).not.toBeNull();
});
it('expira sessão no 401', async () => {
  mock(null, 401); const expired = vi.fn(); render(<GroupResult projectId={2} expired={expired} />); await waitFor(() => expect(expired).toHaveBeenCalled());
});
it('ignora resposta depois de desmontar resultado', async () => {
  let resolve!: (r: Response) => void;
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(r => { resolve = r; }));
  const view = render(<GroupResult projectId={2} expired={vi.fn()} />); view.unmount(); resolve(new Response(JSON.stringify({ data: result })));
});
it('busca e filtros combinados usam cliente HTTP e navegam ao detalhe', async () => {
  const fetch = mock([publication]); const navigate = vi.fn(); render(<Catalog path="/acervo" navigate={navigate} />);
  expect(screen.getByRole('status')).not.toBeNull(); await screen.findByText('Circuito digital');
  for (const [label, value] of [['Buscar por título', 'Circuito'], ['Ano', '2026'], ['Turma', 'T1'], ['Categoria', 'Digital']]) await userEvent.type(screen.getByLabelText(label), value);
  await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/public/projects?title=Circuito&year=2026&className=T1&category=Digital', expect.anything()));
  await userEvent.click(await screen.findByText('Circuito digital')); expect(navigate).toHaveBeenCalledWith('/acervo/1');
});
it('detalhe exibe vídeo e documento e volta ao acervo', async () => {
  mock(publication); const navigate = vi.fn(); render(<Catalog path="/acervo/1" navigate={navigate} />);
  const video = await screen.findByLabelText('Vídeo'); expect(video.hasAttribute('controls')).toBe(true); expect(video.getAttribute('src')).toBe('/api/public/materials/1/content');
  expect(screen.getByText('Abrir Manual').getAttribute('href')).toBe('/api/public/materials/2/content');
  await userEvent.click(screen.getByText('Voltar ao acervo')); expect(navigate).toHaveBeenCalledWith('/acervo');
  fireEvent.error(video); expect(screen.getByRole('alert').textContent).toContain('Não foi possível reproduzir');
});
it('trata erro recuperável e lista vazia', async () => {
  const fetch = mock(null, 503); render(<Catalog path="/acervo" navigate={vi.fn()} />); await screen.findByRole('alert');
  fetch.mockResolvedValue(new Response(JSON.stringify({ data: [] }))); await userEvent.click(screen.getByText('Tentar novamente'));
  expect(await screen.findByText(/Nenhum projeto publicado/)).not.toBeNull();
});
it('detalhe sem materiais', async () => {
  mock({ ...publication, materials: [] }); render(<Catalog path="/acervo/1" navigate={vi.fn()} />); expect(await screen.findByText('Nenhum material autorizado.')).not.toBeNull();
});
