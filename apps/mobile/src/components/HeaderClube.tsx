import { Header } from '@/src/components/Header';
import { useClubeAtivo } from '@/src/contexts/ClubeAtivoContext';
import { identidadeClubeHeader } from '@/src/utils/identidadeHeader';
import { useSessao } from '../contexts/SessaoContext';
import { HeaderPublico } from './PerfilVisitante';

export function HeaderClube() {
  const { clubeAtivo } = useClubeAtivo();
  const { autenticado } = useSessao();
  const identidade = identidadeClubeHeader(clubeAtivo);
  if (!clubeAtivo) return <HeaderPublico />;

  return (
    <Header
      title={identidade.nome}
      logoUrl={identidade.escudo}
      papelUsuario={identidade.papel}
      showLogo
      btnNotificacao={autenticado ? 'bell' : undefined}
      showProfile={!autenticado}
    />
  );
}
