import PaulistaPage from './Paulista';
import { FilterSelect } from '../components/FilterSelect';
import { useSearchParams } from 'react-router-dom';

const COMPETICOES_FEDERACAO = [
  { id: 'paulista', nome: 'Campeonato Paulista', Painel: PaulistaPage },
];

// Entrada das competições da federação. O painel oficial mantém sua própria
// consulta, filtros e navegação; outras federações poderão entrar neste catálogo.
export default function CompeticoesPage() {
  const [params, setParams] = useSearchParams();
  const selecionada = COMPETICOES_FEDERACAO.find(c => c.id === params.get('competicao')) || COMPETICOES_FEDERACAO[0];
  const Painel = selecionada.Painel;
  return <>
    {COMPETICOES_FEDERACAO.length > 1 && <FilterSelect label="Competição da federação" value={selecionada.id} emptyLabel="Selecionar competição" options={COMPETICOES_FEDERACAO.map(c => ({ value: c.id, label: c.nome }))} onChange={value => { if (value) setParams({ competicao: value }); }}/>}
    <Painel key={selecionada.id} competitionHome />
  </>;
}
