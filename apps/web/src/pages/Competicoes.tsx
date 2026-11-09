import { lazy } from 'react';
import PaulistaPage from './Paulista';
import { useAuth } from '../contexts/AuthContext';
import { AccessRequired } from '../components/PublicAccess';
import { FilterSelect } from '../components/FilterSelect';
import { useSearchParams } from 'react-router-dom';

const COMPETICOES_FEDERACAO = [
  { id: 'paulista', nome: 'Campeonato Paulista', Painel: PaulistaPage },
];
const CompeticoesAnteriores = lazy(() => import('./CompeticoesAnteriores'));

// Entrada das competições da federação. O painel oficial mantém sua própria
// consulta, filtros e navegação; outras federações poderão entrar neste catálogo.
export default function CompeticoesPage() {
  const { token } = useAuth();
  const [params, setParams] = useSearchParams();
  const selecionada = COMPETICOES_FEDERACAO.find(c => c.id === params.get('competicao')) || COMPETICOES_FEDERACAO[0];
  const Painel = selecionada.Painel;
  // Mantém a mesma exigência de acesso da rota existente do Paulista.
  if (!token) return <AccessRequired />;
  if (params.get('arquivo') === '1') return <CompeticoesAnteriores />;
  return <>
    {COMPETICOES_FEDERACAO.length > 1 && <FilterSelect label="Competição da federação" value={selecionada.id} emptyLabel="Selecionar competição" options={COMPETICOES_FEDERACAO.map(c => ({ value: c.id, label: c.nome }))} onChange={value => { if (value) setParams({ competicao: value }); }}/>}
    <Painel key={selecionada.id} competitionHome />
  </>;
}
