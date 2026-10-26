import { useEffect, useState } from 'react';
import { Btn, Card, Input } from '@web/components/UI';
import type { ConfigApp } from '../../../shared/bridge';
import { useAdminAuth } from '../contexts/AdminAuthContext';

export default function AjustesPage() {
  const { sair, persistente } = useAdminAuth();
  const [config, setConfig] = useState<ConfigApp | null>(null);
  const [url, setUrl] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => { window.ludora.config.obter().then(c => { setConfig(c); setUrl(c.apiUrl); }); }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (!confirm('Trocar o servidor encerra a sessão atual (o login é específico de cada servidor). Continuar?')) return;
    const r = await window.ludora.config.definirApiUrl(url);
    if (!r.ok) return setErro(r.erro);
    await sair();
  }

  if (!config) return null;
  return (
    <div>
      <div className="page-header"><div><h1 className="page-title">Ajustes</h1><p className="page-sub">Ludora Admin {config.versao} · {config.plataforma}</p></div></div>
      <Card>
        <h2 className="section-title">Servidor da API</h2>
        <form onSubmit={salvar} className="form-grid">
          <Input className="full" label="URL da API" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
          <p className="full dica">Aceita https:// ou http://localhost. As requisições saem pelo processo principal do app, sem CORS e sem expor o token à interface.</p>
          {erro && <div className="full notice-error" role="alert">{erro}</div>}
          <div className="full" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn type="button" variant="ghost" onClick={() => setUrl(config.apiUrlPadrao)}>Usar padrão do build</Btn>
            <Btn type="submit" disabled={url === config.apiUrl}>Salvar e sair</Btn>
          </div>
        </form>
      </Card>
      <Card className="bloco">
        <h2 className="section-title">Segurança da sessão</h2>
        <p className="dica" style={{ margin: 0 }}>
          {config.armazenamentoSeguro
            ? persistente ? 'A sessão fica cifrada pelo cofre do sistema operacional e é restaurada ao reabrir o app.' : 'Cofre do sistema disponível; a sessão será guardada cifrada no próximo login.'
            : 'Cofre do sistema indisponível: por segurança a sessão fica só em memória e você entrará de novo ao reabrir o app.'}
        </p>
      </Card>
    </div>
  );
}
