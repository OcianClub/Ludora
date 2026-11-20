import { useSyncExternalStore } from 'react';
import { getApiConnectionState, getApiConnectionError, retryApiConnection, subscribeApiConnection } from '../services/apiConnection';
import { Icon } from './Icon';

export function ApiConnectionNotice() {
  const state = useSyncExternalStore(subscribeApiConnection, getApiConnectionState);
  const retrying = state === 'connecting' && !!getApiConnectionError();
  if (state !== 'slow' && state !== 'error' && !retrying) return null;
  const failed = state === 'error';
  const title = failed ? 'Conexão interrompida' : retrying ? 'Reconectando ao Ludora' : 'Conectando ao Ludora';
  const detail = failed ? getApiConnectionError()?.message :
    'O primeiro acesso após uma pausa pode levar mais tempo. A página continua assim que o servidor responder.';
  return (
    <aside className="api-connection-notice" data-failed={failed}>
      <span className="api-connection-symbol" aria-hidden="true"><Icon name={failed ? 'alert' : 'refresh'} size={20}/></span>
      <div role={failed ? 'alert' : 'status'} aria-atomic="true"><strong>{title}</strong><p>{detail}</p></div>
      {failed && <button className="btn btn-ghost btn-sm" type="button" onClick={() => void retryApiConnection()}>Tentar novamente</button>}
    </aside>
  );
}
