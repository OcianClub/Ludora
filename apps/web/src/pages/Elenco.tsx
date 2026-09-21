import { useEffect, useState } from 'react';
import { fetchJogadoresPerfis, fetchCategorias, PerfilJogador, Categoria } from '../services/api';
import { Select, Spinner, Empty, PerfilBadge, Card } from '../components/UI';
import './Elenco.css';

export default function ElencoPage() {
  const [perfis, setPerfis] = useState<PerfilJogador[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [loading, setLoading] = useState(true);

  function carregar(catId?: number) {
    setLoading(true);
    Promise.all([fetchJogadoresPerfis(catId), fetchCategorias()])
      .then(([p, c]) => { setPerfis(p); setCategorias(c); })
      .catch(console.error).finally(() => setLoading(false));
  }

  useEffect(() => { carregar(); }, []);

  function mudarCategoria(v: string) {
    setFiltroCategoria(v);
    carregar(v ? Number(v) : undefined);
  }

  const catOpts = categorias.map(c => ({ value: c.id, label: c.nome }));
  const perfisMap = perfis.reduce<Record<string, number>>((acc, j) => {
    const p = j.perfil_ml || 'Sem perfil';
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Elenco</h1><p className="page-sub">Perfis e estatísticas dos atletas</p></div>
      </div>

      <div className="elenco-top">
        <div className="stat-grid" style={{ marginBottom: 0 }}>
          {Object.entries(perfisMap).map(([p, n]) => (
            <div key={p} className="stat-card">
              <p className="stat-label">Perfil</p>
              <p className="stat-value"><PerfilBadge perfil={p === 'Sem perfil' ? undefined : p} /></p>
              <p className="stat-sub">{n} atleta{n > 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>
        <Select label="Filtrar por categoria" options={catOpts} value={filtroCategoria} onChange={e => mudarCategoria(e.target.value)} />
      </div>

      {loading ? <Spinner /> : perfis.length === 0 ? <Empty icon="🏃" message="O clube ainda não publicou informações do elenco" /> : (
        <div className="elenco-grid">
          {perfis.map(j => (
            <Card key={j.id} className="elenco-card">
              <div className="elenco-card-header">
                <div className="elenco-avatar">{j.nome[0]}</div>
                <div>
                  <p className="elenco-nome">{j.nome}</p>
                  <p className="elenco-posicao">{j.posicao}{j.numCamisa ? ` · #${j.numCamisa}` : ''}</p>
                </div>
                <div className="elenco-perfil-badge"><PerfilBadge perfil={j.perfil_ml} /></div>
              </div>
              {j.nota_geral != null && (
                <div className="elenco-nota">
                  <span className="nota-valor">{j.nota_geral.toFixed(1)}</span>
                  <span className="nota-label">nota geral</span>
                </div>
              )}
              <div className="elenco-stats">
                <div className="elenco-stat"><span className="es-val">{j.totalPartidas}</span><span className="es-lbl">Partidas</span></div>
                <div className="elenco-stat"><span className="es-val text-amarelo">{j.totalGols}</span><span className="es-lbl">Gols</span></div>
                <div className="elenco-stat"><span className="es-val text-primaria">{j.totalAssistencias}</span><span className="es-lbl">Assist.</span></div>
                <div className="elenco-stat"><span className="es-val text-vermelho">{j.totalCartoes}</span><span className="es-lbl">Cartões</span></div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
