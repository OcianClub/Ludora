import { useCallback, useEffect, useState } from 'react';
import type { StatusBanco, StatusSistema } from '@ludora/shared-types';
import { Btn, Card, Spinner } from '@web/components/UI';
import { AdminIcon } from '../components/AdminIcon';
import { fetchStatusBanco, fetchStatusSistema } from '../services/api';

const duracao = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min` : `${Math.floor(s / 60)} min`);

function Estado({ ok, texto }: { ok: boolean | null; texto: string }) {
  const cls = ok === null ? 'neutro' : ok ? 'ok' : 'falha';
  return <span className={`estado estado-${cls}`}><AdminIcon name={ok === false ? 'alert' : ok === null ? 'info' : 'check'} size={16} />{texto}</span>;
}

export default function BancoPage() {
  const [banco, setBanco] = useState<StatusBanco | null>(null);
  const [sistema, setSistema] = useState<StatusSistema | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    const [b, s] = await Promise.allSettled([fetchStatusBanco(), fetchStatusSistema()]);
    if (b.status === 'fulfilled') setBanco(b.value); else { setBanco(null); setErro(`Banco: ${b.reason.message}`); }
    if (s.status === 'fulfilled') setSistema(s.value);
    setCarregando(false);
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Banco e integrações</h1><p className="page-sub">Prisma, migrations e serviços conectados à API</p></div>
        <Btn variant="ghost" onClick={() => void carregar()} disabled={carregando}>{carregando ? 'Verificando…' : 'Verificar agora'}</Btn>
      </div>
      {erro && <div className="notice-error" role="alert">{erro}</div>}
      {carregando && !banco && !sistema && <Spinner />}

      {banco && (
        <>
          <div className="stat-grid">
            <div className="stat-card"><p className="stat-label">Banco de dados</p><p className="stat-value text-primaria">{banco.latenciaMs} ms</p><p className="stat-sub">{banco.versaoPostgres}</p></div>
            <div className="stat-card"><p className="stat-label">Migrations aplicadas</p><p className="stat-value">{banco.migracoes.aplicadas}</p><p className="stat-sub">{banco.migracoes.locais !== null ? `${banco.migracoes.locais} neste build` : 'pasta não empacotada'}</p></div>
            <div className="stat-card"><p className="stat-label">Pendentes</p><p className={`stat-value ${banco.migracoes.pendentes?.length ? 'text-vermelho' : ''}`}>{banco.migracoes.pendentes?.length ?? '—'}</p></div>
            <div className="stat-card"><p className="stat-label">Com falha</p><p className={`stat-value ${banco.migracoes.falhas.length ? 'text-vermelho' : ''}`}>{banco.migracoes.falhas.length}</p></div>
          </div>

          {(banco.migracoes.pendentes?.length || banco.migracoes.falhas.length) ? (
            <div className="notice-error" role="alert">
              {banco.migracoes.pendentes?.length ? <>Pendentes: {banco.migracoes.pendentes.join(', ')}. </> : null}
              {banco.migracoes.falhas.length ? <>Com falha: {banco.migracoes.falhas.join(', ')}.</> : null}
            </div>
          ) : null}

          <Card className="bloco">
            <h2 className="section-title">Registros por tabela</h2>
            <div className="tabelas">
              {Object.entries(banco.tabelas).map(([nome, total]) => (
                <div key={nome} className="tabela-item"><span>{nome}</span><strong>{total}</strong></div>
              ))}
            </div>
          </Card>
        </>
      )}

      {sistema && (
        <Card className="bloco">
          <h2 className="section-title">Integrações e servidor</h2>
          <div className="integracoes">
            <div><span>Scout IA (Python)</span><Estado ok={!sistema.integracoes.scoutIA.configurado ? null : sistema.integracoes.scoutIA.acessivel} texto={!sistema.integracoes.scoutIA.configurado ? 'Não configurado' : sistema.integracoes.scoutIA.acessivel ? `Acessível · ${sistema.integracoes.scoutIA.ms} ms` : 'Inacessível'} /></div>
            <div><span>E-mail (Resend)</span><Estado ok={sistema.integracoes.email.configurado ? true : null} texto={sistema.integracoes.email.configurado ? 'Configurado' : 'Não configurado'} /></div>
            <div><span>Supabase Storage</span><Estado ok={sistema.integracoes.supabaseStorage.configurado ? true : null} texto={sistema.integracoes.supabaseStorage.configurado ? 'Configurado' : 'Não configurado'} /></div>
          </div>
          <div className="tabelas" style={{ marginTop: 16 }}>
            <div className="tabela-item"><span>Ambiente</span><strong>{sistema.ambiente}</strong></div>
            <div className="tabela-item"><span>Node</span><strong>{sistema.node}</strong></div>
            <div className="tabela-item"><span>Uptime da API</span><strong>{duracao(sistema.uptimeSegundos)}</strong></div>
            <div className="tabela-item"><span>Memória</span><strong>{sistema.memoriaMB} MB</strong></div>
            <div className="tabela-item"><span>Conexões app/web</span><strong>{sistema.conexoes.principal}</strong></div>
            <div className="tabela-item"><span>Super Admins</span><strong>{sistema.superAdmins}</strong></div>
          </div>
          <p className="dica" style={{ marginTop: 12 }}>Integrações mostram apenas se estão configuradas; chaves e senhas nunca saem da API.</p>
        </Card>
      )}
    </div>
  );
}
