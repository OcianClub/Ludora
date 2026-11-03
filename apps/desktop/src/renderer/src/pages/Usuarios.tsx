import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { UsuarioGlobal } from '@ludora/shared-types';
import { Btn, Empty, Input, Modal, PapelBadge, Spinner } from '@web/components/UI';
import { AdminIcon } from '../components/AdminIcon';
import { fetchUsuarios, revogarSessoes } from '../services/api';

export default function UsuariosPage() {
  const [busca, setBusca] = useState('');
  const [usuarios, setUsuarios] = useState<UsuarioGlobal[] | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  const consulta = useRef(0);
  const [selecionado, setSelecionado] = useState<UsuarioGlobal | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erroSessao, setErroSessao] = useState('');

  const carregar = useCallback((termo: string) => {
    const atual = ++consulta.current;
    setErro('');
    setUsuarios(null);
    fetchUsuarios(termo).then(
      dados => { if (atual === consulta.current) setUsuarios(dados); },
      erro => {
        if (atual === consulta.current) {
          setErro(erro.message);
          setUsuarios([]);
        }
      },
    );
  }, []);
  useEffect(() => {
    carregar('');
    return () => { consulta.current++; };
  }, [carregar]);

  async function revogar() {
    if (!selecionado || ocupado) return;
    setOcupado(true);
    setErroSessao('');
    try {
      await revogarSessoes(selecionado.id);
      setAviso(`Sessões de ${selecionado.nome} encerradas.`);
      setSelecionado(null);
    } catch (erro) {
      setErroSessao((erro as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div>
      <div className="page-header"><div><h1 className="page-title">Usuários</h1><p className="page-sub">Consulte vínculos com clubes e gerencie sessões</p></div></div>
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
                  <td><Btn size="sm" variant="ghost" onClick={() => { setSelecionado(u); setConfirmando(false); setErroSessao(''); }}>Ver conta</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal title={selecionado?.nome ?? 'Conta'} open={!!selecionado} onClose={() => { if (!ocupado) setSelecionado(null); }}>
        {selecionado && <>
          <p className="dica">{selecionado.email} · Conta #{selecionado.id}</p>
          <h3 className="section-title">Vínculos com clubes</h3>
          {selecionado.clubes.length ? <ul>{selecionado.clubes.map(clube => <li key={clube.clube_id}>
            <Link to={`/clubes/${clube.clube_id}`}>{clube.nome}</Link> <PapelBadge papel={clube.papel} />
          </li>)}</ul> : <p className="dica">Nenhum clube vinculado.</p>}
          {confirmando && <p>O usuário terá de entrar novamente em todos os dispositivos.</p>}
          {erroSessao && <div className="notice-error" role="alert">{erroSessao}</div>}
          <div className="actions">
            {confirmando && <Btn variant="ghost" disabled={ocupado} onClick={() => { setConfirmando(false); setErroSessao(''); }}>Voltar</Btn>}
            <Btn variant="danger" disabled={ocupado} onClick={() => confirmando ? void revogar() : setConfirmando(true)}>
              {ocupado ? 'Encerrando…' : confirmando ? 'Confirmar encerramento' : 'Encerrar sessões'}
            </Btn>
          </div>
        </>}
      </Modal>
    </div>
  );
}
