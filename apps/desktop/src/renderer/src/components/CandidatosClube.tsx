import { useEffect, useState } from 'react';
import { ClubBadge } from '@web/components/Brand';
import { Btn } from './AdminUI';
import { requestJson } from '../services/api';
export type Candidato = { eventoId: number; equipeId: number; nome: string; escudo: string | null; categoria: string; divisao: string; ano: number; partidas: number; timeId: number | null };
export function CandidatosClube({ nome, onSelect, selected }: { nome: string; onSelect: (c: Candidato | null) => void; selected: Candidato | null }) {
  const [rows, setRows] = useState<Candidato[]>([]), [erro, setErro] = useState('');
  useEffect(() => {
    let active = true; const t = setTimeout(() => {
      requestJson<Candidato[]>(`/admin/paulista/candidatos?nome=${encodeURIComponent(nome)}`).then(r => { if (active) { setRows(r); setErro(''); } }).catch(() => { if (active) setErro('Integração indisponível para conferir candidatos. O cadastro do clube pode continuar sem vínculo.'); });
    }, 400);
    return () => { active = false; clearTimeout(t); };
  }, [nome]);
  return <section className="full admin-club-review"><h3>Reaproveitar histórico de adversário</h3><p className="dica">As correspondências abaixo são sugestões. Escolher uma não altera dados; a identidade será confirmada no painel Paulista após criar o clube.</p>{erro && <p role="status">{erro}</p>}{!rows.length && !erro && <p>Nenhum candidato encontrado no catálogo consultado.</p>}{rows.map(c => <div key={`${c.eventoId}:${c.equipeId}`} className="linha-clube"><ClubBadge src={c.escudo || undefined} size={32} /><span><strong>{c.nome}</strong><small>{c.categoria} · {c.divisao} · {c.ano} · {c.partidas} jogos conhecidos{!c.timeId ? ' · ainda sem casca operacional' : ''}</small></span><Btn type="button" size="sm" aria-pressed={selected?.eventoId === c.eventoId && selected?.equipeId === c.equipeId} variant={selected?.eventoId === c.eventoId && selected?.equipeId === c.equipeId ? 'primary' : 'ghost'} onClick={() => onSelect(selected?.eventoId === c.eventoId && selected?.equipeId === c.equipeId ? null : c)}>Revisar após cadastro</Btn></div>)}</section>;
}
