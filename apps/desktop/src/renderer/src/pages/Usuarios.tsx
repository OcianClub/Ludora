import { useCallback, useEffect, useState } from 'react';
import type { UsuarioGlobal } from '@ludora/shared-types';
import { Btn, Empty, Input, PapelBadge, Spinner } from '@web/components/UI';
import { AdminIcon } from '../components/AdminIcon';
import { fetchUsuarios, revogarSessoes } from '../services/api';

export default function UsuariosPage() {
  const [busca, setBusca] = useState('');
  const [usuarios, setUsuarios] = useState<UsuarioGlobal[] | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  const carregar = useCallback((termo: string) => {
    setUsuarios(null);
    fetchUsuarios(termo).then(setUsuarios).catch(e => { setErro(e.message); setUsuarios([]); });
  }, []);
  useEffect(() => carregar(''), [carregar]);

  async function revogar(u: UsuarioGlobal) {
    if (!confirm(`Encerrar todas as sessões de ${u.nome}? Ele precisará entrar de novo em todos os aparelhos.`)) return;
    try { await revogarSessoes(u.id); setErro(''); setAviso(`Sessões de ${u.nome} encerradas.`); } catch (e) { setAviso(''); setErro((e as Error).message); }
  }

  return (
    <div>
      <div className="page-header"><div><h1 className="page-title">Usuários</h1><p className="page-sub">Todas as contas da plataforma · senhas nunca são exibidas</p></div></div>
      {erro && <div className="notice-error" role="alert">{erro}</div>}
      {aviso && <div className="notice-ok" role="status">{aviso}</div>}

      <form className="filter-bar" onSubmit={e => { e.preventDefault(); carregar(busca); }}>
        <Input label="Buscar" placeholder="Nome ou e-mail..." value={busca} onChange={e => setBusca(e.target.value)} />
        <Btn type="submit" variant="ghost"><AdminIcon name="search" size={18} /> Buscar</Btn>
      </form>

      {!usuarios ? <Spinner /> : usuarios.length === 0 ? <Empty icon="👥" message="Nenhum usuário encontrado" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Usuário</th><th>Clubes e cargos</th><th>Criado em</th><th /></tr></thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.nome}</strong>{u.superadmin && <span className="plano-tag" style={{ marginLeft: 8 }}>SUPER ADMIN</span>}<br /><small className="text-sec">{u.email}</small></td>
                  <td><div className="chips">{u.clubes.length === 0 ? '—' : u.clubes.map(c => <span key={c.clube_id} className="chip">{c.nome} <PapelBadge papel={c.papel} /></span>)}</div></td>
                  <td>{new Date(u.criadoEm).toLocaleDateString('pt-BR')}</td>
                  <td><Btn size="sm" variant="danger" onClick={() => void revogar(u)}><AdminIcon name="lock" size={16} /> Encerrar sessões</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
