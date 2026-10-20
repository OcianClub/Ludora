import { Header } from '@/src/components/Header';
import { useClubeAtivo } from '@/src/contexts/ClubeAtivoContext';
import { identidadeClubeHeader } from '@/src/utils/identidadeHeader';

export function HeaderClube() {
  const { clubeAtivo } = useClubeAtivo();
  const identidade = identidadeClubeHeader(clubeAtivo);

  return (
    <Header
      title={identidade.nome}
      logoUrl={identidade.escudo}
      papelUsuario={identidade.papel}
      showLogo
      showProfile
      btnNotificacao="bell"
    />
  );
}
