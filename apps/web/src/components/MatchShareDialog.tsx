import { useEffect, useMemo, useRef, useState } from 'react';
import type { GestaoPartida } from '../services/sharedMatches';
import { matchShareModel } from '../utils/matchShare';
import { matchResultText } from '../utils/matchResult';
import { Btn, Modal } from './UI';
import { Icon } from './Icon';
import './ThemeToggle.css';
import './MatchShareDialog.css';

export default function MatchShareDialog({ data, onClose, onFeedback }: {
  data: GestaoPartida; onClose: () => void; onFeedback: (message: string) => void;
}) {
  const [includeNames, setIncludeNames] = useState(false);
  const [includeHighlights, setIncludeHighlights] = useState(true);
  const [image, setImage] = useState<{ blob: Blob; url: string; model: object; names: boolean } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const model = useMemo(() => matchShareModel(data, includeNames, includeHighlights), [data, includeNames, includeHighlights]);
  const current = image?.model === model && image.names === includeNames ? image : null;
  const filename = `ludora-partida-${data.partida.id}.png`;
  const file = current ? new File([current.blob], filename, { type: 'image/png' }) : null;
  const canShare = Boolean(file && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }));
  useEffect(() => {
    let active = true;
    let url: string | undefined;
    setError('');
    // Load the image renderer only when sharing is opened; live operations stay lightweight.
    void import('../utils/matchResultImage').then(module => module.renderMatchResultImage(model, includeNames)).then(blob => {
      if (!active) return;
      url = URL.createObjectURL(blob);
      setImage({ blob, url, model, names: includeNames });
    }).catch(() => { if (active) setError('Não foi possível preparar a imagem. Tente novamente ou copie o link da partida.'); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [model, includeNames, attempt]);

  function download() {
    if (!current) return;
    const link = document.createElement('a');
    link.href = current.url; link.download = filename; document.body.append(link); link.click(); link.remove();
    onFeedback('Imagem pronta para baixar.');
  }
  async function share() {
    if (!file || !canShare || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      await navigator.share({ files: [file], title: `${model.teams[0].name} × ${model.teams[1].name} · Ludora` });
      onFeedback('Imagem compartilhada.');
    } catch (cause) {
      if ((cause as Error).name !== 'AbortError') setError('O dispositivo não concluiu o compartilhamento. Use “Baixar imagem” e envie o PNG pelo aplicativo que preferir.');
    } finally { busyRef.current = false; setBusy(false); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(location.href); onFeedback('Link da partida copiado.'); }
    catch { setError('Não foi possível copiar. Copie o endereço da partida na barra do navegador.'); }
  }
  return <Modal open title="Compartilhar resultado" className="live-small-dialog match-result-share" onClose={() => { if (!busyRef.current) onClose(); }}
    footer={<div className="match-image-actions">
      <Btn variant="ghost" disabled={busy} onClick={onClose}>Voltar</Btn>
      {canShare && <Btn variant="ghost" disabled={busy || !current} onClick={download}>Baixar imagem</Btn>}
      <Btn disabled={busy || !current} onClick={canShare ? () => void share() : download}><Icon name="share" size={17} />{busy ? 'Compartilhando…' : canShare ? 'Compartilhar imagem' : 'Baixar imagem'}</Btn>
    </div>}>
    <div className="match-image-preview" aria-busy={!current && !error} aria-label="Prévia da imagem do resultado">
      {current ? <img src={current.url} alt={`${model.title}: ${model.teams[0].name} ${model.teams[0].score} a ${model.teams[1].score} ${model.teams[1].name}${includeNames ? ', com autores dos gols' : ', sem nomes de jogadores'}`} /> : <span role="status">{error ? 'Prévia indisponível' : 'Preparando imagem…'}</span>}
    </div>
    <div className="match-result-name-setting">
      <div><strong id="share-player-names">Incluir nomes dos jogadores</strong><p id="share-player-description">Mostra os nomes nos gols e destaques. Desligado, os destaques usam a camisa.</p></div>
      <button className="settings-switch" type="button" role="switch" aria-checked={includeNames} aria-labelledby="share-player-names" aria-describedby="share-player-description" disabled={busy} onClick={() => setIncludeNames(value => !value)}><span className="settings-switch-thumb" aria-hidden="true"><Icon name="user" size={13} /></span></button>
    </div>
    <div className="match-result-name-setting">
      <div><strong id="share-match-highlights">Incluir destaques</strong><p>Participação em gols e defesas registradas, com empates preservados.</p></div>
      <button className="settings-switch" type="button" role="switch" aria-checked={includeHighlights} aria-labelledby="share-match-highlights" disabled={busy} onClick={() => setIncludeHighlights(value => !value)}><span className="settings-switch-thumb" aria-hidden="true"><Icon name="trophy" size={13} /></span></button>
    </div>
    <div className="match-image-links"><button type="button" disabled={busy} onClick={() => void copyLink()}>Copiar link da partida</button><span>PNG · resultado de todos os tempos</span></div>
    <details className="match-share-message"><summary><Icon name="list" size={16} />Versão em texto<Icon name="chevronRight" size={16} /></summary>
      <label className="sr-only" htmlFor="match-result-preview">Prévia do compartilhamento</label>
      <textarea id="match-result-preview" className="match-result-preview" readOnly value={`${data.paulista ? 'Anotações do clube · resultado oficial na federação.\n' : ''}${matchResultText(data, includeNames)}`} />
    </details>
    {error && <div role="alert" className="match-image-error"><p>{error}</p>{!current && <Btn variant="ghost" size="sm" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</Btn>}</div>}
  </Modal>;
}
