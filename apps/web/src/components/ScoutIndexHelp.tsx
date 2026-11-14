import { useState } from 'react';
import { Icon } from './Icon';
import { Btn } from './UI';
import { ResponsivePanel } from './ResponsivePanel';

export function ScoutIndexHelp({ label = 'Como interpretar o Scout' }: { label?: string }) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return (
    <div className="scout-index-help">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={!!anchor}
        onClick={event => setAnchor(anchor ? null : event.currentTarget)}
      >
        <Icon name="info" size={16} /> {label}
      </button>
      {anchor && <ResponsivePanel
        anchor={anchor}
        wide
        title="Como interpretar o Scout"
        className="scout-index-dialog"
        onClose={() => setAnchor(null)}
        footer={<Btn size="sm" onClick={() => setAnchor(null)}>Entendi</Btn>}
      >
        <p>
          O Scout descreve os eventos registrados e as convocações em partidas
          finalizadas. Uma convocação não comprova entrada em campo; não há
          estimativa de minutos jogados.
        </p>
        <p>
          Artilheiro, Armador e Paredão indicam predominância de gols,
          assistências ou defesas nos registros. Misto indica empate entre essas
          contribuições. O perfil exige pelo menos 5 convocações e 3 eventos;
          não é uma nota de habilidade ou uma posição recomendada.
        </p>
        <p>
          O modelo de similaridade compara médias por convocação entre atletas
          da mesma categoria e posição, quando há pelo menos 5 atletas com
          amostra suficiente. Semelhança estatística não significa qualidade
          equivalente.
        </p>
        <p>
          Dados ausentes não são habilidades ausentes. Os filtros da ficha mudam
          o recorte inteiro; partidas ao vivo são provisórias e ficam fora das
          médias históricas e do treinamento.
        </p>
        <p>
          No radar, cada eixo mostra uma contagem real. A escala vai até a maior
          contagem do período selecionado; um desenho maior não significa melhor
          desempenho. O gráfico de jogos soma gols, assistências e defesas em
          cada barra. As médias usam as últimas cinco partidas com registro, ou
          as disponíveis quando houver menos.
        </p>
      </ResponsivePanel>}
    </div>
  );
}
