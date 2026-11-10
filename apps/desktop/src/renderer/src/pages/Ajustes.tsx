import { useCallback, useEffect, useState } from 'react';
import { Btn, DesktopSection, DesktopState, Input, LoadingSkeleton, Modal } from '../components/AdminUI';
import { AdminIcon } from '../components/AdminIcon';
import type { ConfigApp } from '../../../shared/bridge';
import { useAdminAuth } from '../contexts/AdminAuthContext';

export default function AjustesPage() {
  const { sair, persistente } = useAdminAuth();
  const [config, setConfig] = useState<ConfigApp | null>(null);
  const [url, setUrl] = useState('');
  const [erro, setErro] = useState('');
  const [erroConfig, setErroConfig] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregarConfig = useCallback(() => {
    setErroConfig('');
    return window.ludora.config.obter().then(c => { setConfig(c); setUrl(c.apiUrl); })
      .catch(() => setErroConfig('Não foi possível consultar a configuração deste aplicativo.'));
  }, []);
  useEffect(() => { void carregarConfig(); }, [carregarConfig]);

  async function salvar() {
    if (salvando) return;
    setSalvando(true);
    setErro('');
    try {
      const r = await window.ludora.config.definirApiUrl(url.trim());
      if (!r.ok) return setErro(r.erro);
      await sair();
    } catch { setErro('Não foi possível trocar o servidor. Confira a conexão e tente novamente.'); }
    finally { setSalvando(false); }
  }

  if (!config) return erroConfig ? <DesktopState error title="Não foi possível abrir os ajustes" description={erroConfig} onRetry={() => void carregarConfig()}/> : <LoadingSkeleton kind="form" label="Carregando ajustes" count={2}/>;
  return (
    <div className="desktop-settings-page">
      <div className="page-header"><div><h1 className="page-title">Ajustes</h1><p className="page-sub">Ludora Admin {config.versao} · {config.plataforma}</p></div></div>
      <DesktopSection title="Servidor da API" description="Escolha o ambiente que este aplicativo vai administrar.">
        <form onSubmit={e => { e.preventDefault(); if (url.trim() && url.trim() !== config.apiUrl) { setErro(''); setConfirmando(true); } }} className="form-grid">
          <Input className="full" label="URL da API" value={url} required maxLength={2048} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
          <p className="full dica">Use HTTPS para um servidor publicado ou HTTP em localhost. Trocar o servidor encerra a sessão atual.</p>
          <div className="full" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn type="button" variant="ghost" onClick={() => setUrl(config.apiUrlPadrao)}>Usar padrão do build</Btn>
            <Btn type="submit" disabled={!url.trim() || url.trim() === config.apiUrl}>Revisar alteração</Btn>
          </div>
        </form>
      </DesktopSection>
      <DesktopSection title="Segurança da sessão">
        <div className="desktop-session-state"><AdminIcon name="lock" size={21}/><p>
          {config.armazenamentoSeguro
            ? persistente ? 'A sessão fica cifrada pelo cofre do sistema operacional e é restaurada ao reabrir o app.' : 'Cofre do sistema disponível; a sessão será guardada cifrada no próximo login.'
            : 'Cofre do sistema indisponível: por segurança a sessão fica só em memória e você entrará de novo ao reabrir o app.'}
        </p></div>
      </DesktopSection>
      {confirmando && <Modal open title="Trocar servidor?" className="schedule-review-dialog" onClose={() => { if (!salvando) setConfirmando(false); }}
        footer={<div className="schedule-review-actions"><Btn variant="ghost" disabled={salvando} onClick={() => setConfirmando(false)}>Cancelar</Btn><Btn disabled={salvando} onClick={() => void salvar()}>{salvando ? 'Salvando…' : 'Trocar servidor e sair'}</Btn></div>}>
        <div className="schedule-review"><p>Você precisará entrar novamente. Sua sessão atual não será enviada ao novo servidor.</p><div className="desktop-server-review"><span>Atual</span><strong>{config.apiUrl}</strong><span>Novo</span><strong>{url.trim()}</strong></div>
        {erro && <p role="alert" className="notice-error">{erro}</p>}</div>
      </Modal>}
    </div>
  );
}
