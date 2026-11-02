import { useState } from 'react';
import { Icon } from './Icon';
import { Btn, Modal } from './UI';

export function ScoutIndexHelp() {
  const [open, setOpen] = useState(false);
  return <div className="scout-index-help">
    <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}><Icon name="info" size={16}/> Como interpretar o Scout</button>
    <Modal open={open} title="Como interpretar o Scout" className="scout-index-dialog" onClose={() => setOpen(false)}
      footer={<Btn onClick={() => setOpen(false)}>Entendi</Btn>}>
      <p>O Scout descreve os eventos registrados e as convocações em partidas finalizadas. Uma convocação não comprova entrada em campo; não há estimativa de minutos jogados.</p>
      <p>Artilheiro, Armador e Paredão indicam predominância de gols, assistências ou defesas nos registros. Misto indica empate entre essas contribuições. O perfil exige pelo menos 5 convocações e 3 eventos; não é uma nota de habilidade ou uma posição recomendada.</p>
      <p>O modelo de similaridade compara médias por convocação entre atletas da mesma categoria e posição, quando há pelo menos 5 atletas com amostra suficiente. Semelhança estatística não significa qualidade equivalente.</p>
      <p>Dados ausentes não são habilidades ausentes. Os filtros da ficha mudam o recorte inteiro; partidas ao vivo são provisórias e ficam fora das médias históricas e do treinamento.</p>
    </Modal>
  </div>;
}
