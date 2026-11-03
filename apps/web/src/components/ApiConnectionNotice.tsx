import { useSyncExternalStore } from 'react';
import { getApiConnectionState, subscribeApiConnection } from '../services/apiConnection';

export function ApiConnectionNotice() {
  const state = useSyncExternalStore(subscribeApiConnection, getApiConnectionState);
  if (state !== 'slow') return null;
  return (
    <div className="api-connection-notice" role="status" aria-live="polite">
      <span>Conectando ao servidor… O primeiro acesso pode levar cerca de um minuto.</span>
    </div>
  );
}
