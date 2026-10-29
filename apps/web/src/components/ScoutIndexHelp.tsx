import { useState } from 'react';
import { Icon } from './Icon';
import { Btn, Modal } from './UI';

export function ScoutIndexHelp() {
  const [open, setOpen] = useState(false);
  return <div className="scout-index-help">
    <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}><Icon name="info" size={16}/> Como entender o índice</button>
    <Modal open={open} title="Como entender o índice" className="scout-index-dialog" onClose={() => setOpen(false)}
      footer={<Btn onClick={() => setOpen(false)}>Entendi</Btn>}>
      <p>O índice é a média de finalização, visão de jogo, defesa, disciplina e técnica calculadas pelo Scout IA. Os indicadores são relativos ao grupo de atletas analisado e usam os registros disponíveis. Compare atletas de posições diferentes com cautela: o índice não é uma nota absoluta.</p>
    </Modal>
  </div>;
}
