import { CompetitionPanel } from '../components/CompetitionPanel';
import { Link } from 'react-router-dom';
import './SharedMatches.css';
import { useEffect, useState } from 'react';
import {
  fetchCompeticoes,
  atualizarCompeticao,
  deletarCompeticao,
  type Competicao,
} from '../services/api';
import { Btn, Modal, Input, LoadingSkeleton } from '../components/UI';
import { Choice, type ViewMode } from '../components/CollectionControls';
import {
  CollectionSearch,
  CollectionFilterButton,
  CollectionFilterDialog,
  CollectionViewToggle,
} from '../components/CollectionToolbar';
import { FilterSelect } from '../components/FilterSelect';
import { BlockColumns } from '../components/BlockColumns';
import { Icon } from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import './Competicoes.css';

const TIPOS = [
  { value: 'BASE', label: 'Base' },
  { value: 'INICIACAO', label: 'Iniciação' },
];
const FORM_VAZIO = { nome: '', ano: '', tipo: 'BASE', titulares_necessarios: '5', exigir_inscricao: false };

export default function CompeticoesAnteriores() {
  const { podeGerenciar, clube } = useAuth();
  const [competicoes, setCompeticoes] = useState<Competicao[]>([]);
  const [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [busca, setBusca] = useState(''),
    [phase, setPhase] = useState(''),
    [year, setYear] = useState('');
  const [view, setView] = useState<ViewMode>('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftPhase, setDraftPhase] = useState(''),
    [draftYear, setDraftYear] = useState('');
  const [details, setDetails] = useState<Competicao | null>(null);
  const [editando, setEditando] = useState<Competicao | null>(null);
  const [deleting, setDeleting] = useState<Competicao | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [busy, setBusy] = useState(false),
    [erro, setErro] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    fetchCompeticoes()
      .then((items) => {
        if (active) setCompeticoes(items);
      })
      .catch((e) => {
        if (active) setLoadError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [clube?.id, version]);

  function open(c: Competicao) {
    setEditando(c);
    setForm({ nome: c.nome, ano: String(c.ano), tipo: c.tipo, titulares_necessarios: String(c.titulares_necessarios || 5), exigir_inscricao: c.exigir_inscricao || false });
    setErro('');
  }
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setErro('');
    setBusy(true);
    try {
      const dados = {
        nome: form.nome.trim(),
        ano: Number(form.ano),
        tipo: form.tipo,
        titulares_necessarios: Number(form.titulares_necessarios),
        exigir_inscricao: form.exigir_inscricao,
      };
      await atualizarCompeticao(editando.id, dados);
      setEditando(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function excluir() {
    if (!deleting) return;
    setBusy(true);
    setErro('');
    try {
      await deletarCompeticao(deleting.id);
      setDeleting(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const locais = competicoes.filter(c => !c.paulista_evento_id);
  const visible = locais.filter(c => c.nome.toLocaleLowerCase().includes(busca.toLocaleLowerCase()) &&
    (!phase || c.tipo === phase) && (!year || String(c.ano) === year))
    .sort((a, b) => b.ano - a.ano || a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
  const seasons = [...new Set(locais.map(c => c.ano))]
    .sort((a, b) => b - a)
    .map((ano) => ({ value: String(ano), label: String(ano) }));
  return (
    <div className="competition-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">CALENDÁRIO DO CLUBE</span>
          <h1 className="page-title">Competições anteriores</h1>
          <p className="page-sub">Consulte os torneios já registrados pelo clube.</p>
        </div>
        <Link className="btn btn-ghost btn-md" to="/competicoes">Campeonato Paulista<Icon name="chevronRight" size={16}/></Link>
      </div>
      <div className="competition-toolbar">
        <CollectionSearch
          label="Buscar competição"
          value={busca}
          onChange={setBusca}
          placeholder="Nome do torneio"
        />
        <div className="competition-desktop-filters">
          <FilterSelect
            label="Fase"
            value={phase}
            onChange={setPhase}
            emptyLabel="Todas"
            options={TIPOS}
          />
          <FilterSelect
            label="Temporada"
            value={year}
            onChange={setYear}
            emptyLabel="Todas"
            options={seasons}
          />
        </div>
        <CollectionFilterButton
          className="competition-mobile-filter"
          count={Number(!!phase) + Number(!!year)}
          onClick={() => {
            setDraftPhase(phase);
            setDraftYear(year);
            setFiltersOpen(true);
          }}
        />
      </div>
      <CollectionFilterDialog
        open={filtersOpen}
        title="Filtrar competições"
        onClose={() => setFiltersOpen(false)}
        onClear={() => {
          setDraftPhase('');
          setDraftYear('');
        }}
        onApply={() => {
          setPhase(draftPhase);
          setYear(draftYear);
          setFiltersOpen(false);
        }}
      >
        <FilterSelect
          label="Fase"
          value={draftPhase}
          onChange={setDraftPhase}
          emptyLabel="Todas"
          options={TIPOS}
          inlineOptions
        />
        <FilterSelect
          label="Temporada"
          value={draftYear}
          onChange={setDraftYear}
          emptyLabel="Todas"
          options={seasons}
          inlineOptions
        />
      </CollectionFilterDialog>
      {loading ? (
        <LoadingSkeleton kind="cards" />
      ) : loadError ? (
        <p className="notice-error" role="alert">
          {loadError}
        </p>
      ) : (
        <>
          <div className="competition-results">
            <p className="competition-count">
              {visible.length} competições encontradas
            </p>
            <CollectionViewToggle
              value={view}
              onChange={(value) => setView(value === 'list' ? 'list' : 'grid')}
              options={[
                { value: 'grid', label: 'Cards', icon: 'grid' },
                { value: 'list', label: 'Lista', icon: 'list' },
              ]}
            />
          </div>
          <BlockColumns list={view === 'list'}>
            {visible.map((c) => (
              <article
                key={c.id}
                className={`competition-card ${view === 'list' ? 'competition-row' : ''}`}
              >
                <div className="competition-identity">
                  <span className="competition-icon">
                    <Icon name="trophy" size={24} />
                  </span>
                  <div>
                    <small>
                      {c.ano} · {c.tipo === 'BASE' ? 'Base' : 'Iniciação'}
                    </small>
                    <h2>{c.nome}</h2>
                  </div>
                </div>
                <div className="competition-actions">
                  <Btn variant="ghost" size="sm" onClick={() => setDetails(c)}>Ver competição</Btn>
                  {podeGerenciar && !c.somente_leitura && (
                    <>
                      <Btn variant="ghost" size="sm" onClick={() => open(c)}>
                        Regulamento
                      </Btn>
                      <Btn
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setErro('');
                          setDeleting(c);
                        }}
                      >
                        Arquivar
                      </Btn>
                    </>
                  )}
                </div>
              </article>
            ))}
          </BlockColumns>
          {!visible.length && (
            <p className="collection-empty">
              Nenhuma competição corresponde aos filtros.
            </p>
          )}
        </>
      )}
      {details && (
        <CompetitionPanel
          competition={details}
          onClose={() => setDetails(null)}
        />
      )}
      <Modal
        open={!!deleting}
        title="Arquivar competição"
        onClose={() => {
          if (!busy) setDeleting(null);
        }}
      >
        <p>
          Retirar <strong>{deleting?.nome}</strong> da lista? As partidas e o
          histórico existentes serão preservados.
        </p>
        {erro && (
          <p role="alert" className="notice-error">
            {erro}
          </p>
        )}
        <div className="editor-actions">
          <Btn
            variant="ghost"
            disabled={busy}
            onClick={() => setDeleting(null)}
          >
            Voltar
          </Btn>
          <Btn disabled={busy} onClick={() => void excluir()}>
            {busy ? 'Salvando…' : 'Confirmar'}
          </Btn>
        </div>
      </Modal>
      <Modal
        open={!!editando}
        onClose={() => {
          if (!busy) setEditando(null);
        }}
        title="Editar competição"
      >
        <form onSubmit={salvar} className="form-grid">
          <Input
            label="Nome"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            required
            maxLength={100}
            className="full"
          />
          <Input
            label="Ano"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            value={form.ano}
            onChange={(e) =>
              setForm((f) => ({ ...f, ano: e.target.value.replace(/\D/g, '') }))
            }
            required
          />
          <Choice
            label="Fase"
            value={form.tipo}
            options={TIPOS}
            onChange={(tipo) => setForm((f) => ({ ...f, tipo }))}
          />
          <Input
            label="Titulares por equipe"
            type="number"
            min="1"
            max="15"
            value={form.titulares_necessarios}
            onChange={(e) =>
              setForm((f) => ({ ...f, titulares_necessarios: e.target.value }))
            }
          />
          <label className="full shared-own-goal">
            <input
              type="checkbox"
              checked={form.exigir_inscricao}
              onChange={(e) =>
                setForm((f) => ({ ...f, exigir_inscricao: e.target.checked }))
              }
            />
            Exigir inscrição dos convocados
          </label>
          <p className="editor-description full">
            O regulamento fica fixo quando houver partidas.
          </p>
          {erro && (
            <p className="notice-error full" role="alert">
              {erro}
            </p>
          )}
          <div className="collection-dialog-actions full">
            <Btn
              variant="ghost"
              type="button"
              disabled={busy}
              onClick={() => setEditando(null)}
            >
              Cancelar
            </Btn>
            <Btn type="submit" disabled={busy}>
              {busy ? 'Salvando…' : 'Salvar'}
            </Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
