import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, it, expect, vi } from 'vitest';
import { GroupResult } from './GroupResult';
import type { ResultView } from './readApi';
const result: ResultView = { projectId: 2, groupId: 2, round: 1, expected: 2, received: 1, pending: 1, complete: false, released: false, grade: 8, rubricVersionId: 'r1', criteria: [{ title: 'Circuito', weight: 100, grade: 8, comment: 'Comentário liberado' }] };
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
it('oculta o contrato mínimo bloqueado da consolidação sem inventar rodada', async () => {
  mock({ projectId: 2, resultReleased: false });
  render(<GroupResult projectId={2} expired={vi.fn()} />);
  expect(await screen.findByText(/Resultado bloqueado/)).toBeTruthy();
  expect(screen.queryByText(/Rodada/)).toBeNull();
  expect(screen.queryByText(/Nota:/)).toBeNull();
});
it('integra notas por critério e comentários do contrato HU09, incluindo zero', async () => {
  mock({ projectId: 2, resultReleased: true, round: 3, rubricVersionId: 5,
    expectedEvaluatorIds: [2, 4], receivedEvaluatorIds: [2, 4], pendingEvaluatorIds: [],
    allEvaluationsCompleted: true, grade: 0,
    rubric: { criteria: [{ id: 'c1', title: 'Circuito', weight: 100 }] },
    evaluations: [{ evaluatorId: 2, scores: [{ criterionId: 'c1', score: 0, comment: 'Revisar circuito' }] },
      { evaluatorId: 4, scores: [{ criterionId: 'c1', score: 0, comment: '' }] }] });
  render(<GroupResult projectId={2} expired={vi.fn()} />);
  expect(await screen.findByText('Nota: 0.00')).toBeTruthy();
  expect(screen.getByText('Rubrica: 5')).toBeTruthy();
  expect(screen.getByText('Revisar circuito')).toBeTruthy();
  expect(screen.getByText('Peso: 100% · Nota: 0.00')).toBeTruthy();
});
