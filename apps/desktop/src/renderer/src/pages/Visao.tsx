import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { VisaoGlobal } from '@ludora/shared-types';
import { ClubBadge } from '@web/components/Brand';
import { Btn, Card, Empty, Spinner } from '@web/components/UI';
import { fetchVisaoGlobal } from '../services/api';

export default function VisaoPage() {
  const [dados, setDados] = useState<VisaoGlobal | null>(null);
  const [erro, setErro] = useState('');

  const carregar = useCallback(() => {
    setErro('');
    fetchVisaoGlobal().then(setDados).catch(e => setErro(e.message));
  }, []);
  useEffect(carregar, [carregar]);

  if (erro) return <div className="notice-error" role="alert">{erro} <Btn size="sm" variant="ghost" onClick={carregar}>Tentar de novo</Btn></div>;
  if (!dados) return <Spinner />;
  const { totais, conexoes, clubes } = dados;

  const cartoes: [string, number, string?][] = [
    ['Clubes', totais.clubes],
    ['Usuários', totais.usuarios],
    ['Jogadores', totais.jogadores],
    ['Partidas', totais.partidas],
    ['Ao vivo agora', totais.partidasAoVivo, totais.partidasAoVivo ? 'text-amarelo' : undefined],
    ['Apps e web conectados', conexoes.principal, 'text-primaria'],
  ];

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Visão global</h1><p className="page-sub">Todos os clubes da plataforma</p></div>
        <Btn variant="ghost" onClick={carregar}>Atualizar</Btn>
      </div>

      <div className="stat-grid">
        {cartoes.map(([rotulo, valor, cor]) => (
          <div key={rotulo} className="stat-card"><p className="stat-label">{rotulo}</p><p className={`stat-value ${cor ?? ''}`}>{valor}</p></div>
        ))}
      </div>

      <Card>
        <h2 className="section-title">Clubes</h2>
        {clubes.length === 0 ? <Empty icon="🛡" message="Nenhum clube cadastrado" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Clube</th><th>Plano</th><th>Membros</th><th>Categorias</th><th>Jogadores</th><th>Partidas</th></tr></thead>
              <tbody>
                {clubes.map(c => (
                  <tr key={c.id}>
                    <td><Link to={`/clubes/${c.id}`} className="linha-clube"><ClubBadge src={c.escudo} size={32} /><span><strong>{c.nome}</strong><small>{[c.cidade, c.estado].filter(Boolean).join(', ') || '—'}</small></span></Link></td>
                    <td><span className="plano-tag">{c.plano}</span></td>
                    <td>{c.membros}</td><td>{c.categorias}</td><td>{c.jogadores}</td><td>{c.partidas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
