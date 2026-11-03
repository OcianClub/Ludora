import { useSyncExternalStore } from 'react';
import { getApiConnectionState, retryApiConnection, subscribeApiConnection } from '../services/apiConnection';

export function ApiConnectionNotice() {
  const state = useSyncExternalStore(subscribeApiConnection, getApiConnectionState);
  if (state !== 'slow' && state !== 'error') return null;
  return (
    <div className="api-connection-notice" role="status" aria-live="polite">
      <span>{state === 'slow'
        ? 'Conectando ao servidor… O primeiro acesso pode levar cerca de um minuto.'
        : 'Não foi possível conectar ao servidor.'}</span>
      {state === 'error' && <button type="button" onClick={retryApiConnection}>Tentar novamente</button>}
    </div>
  );
}
