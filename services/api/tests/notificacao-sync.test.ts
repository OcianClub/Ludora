import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { sincronizarNotificacoes } from '../src/modules/notificacoes/notificacao-sync';
function execute(method: string, status: number, user?: number) {
  const calls: unknown[] = [];
  const response = Object.assign(new EventEmitter(), { statusCode: status });
  const req: any = { method, app: { get: () => ({ to: (room: string) => ({ emit: (event: string, data: unknown) => calls.push({ room, event, data }) }) }) } };
  let continued = false;
  sincronizarNotificacoes(req, response as any, () => { continued = true; });
  assert.equal(continued, true); assert.equal(calls.length, 0);
  req.usuarioId = user; req.clubeId = 11; response.emit('finish'); return calls;
}
test('read/delete updates reach every session in the owning account room', () => {
  for (const method of ['PATCH', 'DELETE']) assert.deepEqual(execute(method, 200, 7), [{ room: 'usuario:7', event: 'notificacoes_atualizadas', data: { clubeId: 11 } }]);
});
test('denied or failed changes never broadcast account data', () => {
  for (const status of [401, 403, 404, 500]) assert.deepEqual(execute('PATCH', status, 7), []);
  assert.deepEqual(execute('DELETE', 200), []);
});
test('reading the inbox does not trigger a refresh feedback loop', () => { assert.deepEqual(execute('GET', 200, 7), []); });
