import { novoRequestId } from './requestId';
import { BASE_URL } from './config';
import { getToken, getClubeId } from './api';

let ultimoEnvio = 0;
function registrar(erro: unknown) {
  const token = getToken();
  if (!token || Date.now() - ultimoEnvio < 5000) return;
  ultimoEnvio = Date.now();
  const stack = String((erro as Error)?.stack || '').split('\n').slice(1, 10)
    .map(line => line.match(/([\w.-]+\.(?:js|tsx?)):\d+:\d+/)?.[0]).filter(Boolean).join('\n');
  void fetch(`${BASE_URL}/suporte/ocorrencias`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-clube-id': String(getClubeId() || ''), 'x-request-id': novoRequestId() },
    body: JSON.stringify({ rota: location.pathname, versao: import.meta.env.VITE_APP_VERSION || 'desenvolvimento', stack: '\n' + stack }),
  }).catch(() => undefined);
}
window.addEventListener('error', event => registrar(event.error));
window.addEventListener('unhandledrejection', event => registrar(event.reason));
