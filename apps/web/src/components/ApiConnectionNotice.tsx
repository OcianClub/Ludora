import { useSyncExternalStore } from 'react';
import { getApiConnectionState, getApiConnectionError, retryApiConnection, subscribeApiConnection } from '../services/apiConnection';
import { Icon } from './Icon';

export function ApiConnectionNotice() {
  const state = useSyncExternalStore(subscribeApiConnection, getApiConnectionState);
  if (state !== 'slow' && state !== 'error') return null;
  const failed = state === 'error';
  return (
    <div className="api-connection-notice" role={failed ? 'alert' : 'status'} aria-live="polite">
      <Icon name={failed ? 'alert' : 'clock'} size={20}/>
      <span>{failed ? getApiConnectionError()?.message : 'A primeira conexão com o servidor pode levar um pouco mais de tempo. Aguarde enquanto preparamos o sistema.'}</span>
      {failed && <button className="btn btn-ghost btn-sm" type="button" onClick={() => void retryApiConnection()}>Tentar novamente</button>}
    </div>
  );
}
