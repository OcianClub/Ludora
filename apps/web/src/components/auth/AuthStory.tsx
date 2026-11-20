import { Brand } from '../Brand';
import { Icon } from '../Icon';
import { PositionIcon } from '../PositionIcon';
import './AuthStory.css';

export type RegistrationStep = 1 | 2 | 3;

const features = {
  1: {
    title: 'Organize seu',
    accent: 'clube.',
    description: 'Gerencie equipes, categorias e escalações em um só lugar.',
    icon: 'team',
  },
  2: {
    title: 'Acompanhe o',
    accent: 'jogo ao vivo.',
    description: 'Veja o placar e os acontecimentos em tempo real.',
    icon: 'ball',
  },
  3: {
    title: 'Conheça seus',
    accent: 'atletas.',
    description: 'Consulte o histórico e os perfis de desempenho no Scout.',
    icon: 'radar',
  },
} as const;

const lineup = [
  { shirt: '01', name: 'Lucas Almeida', position: 'Goleiro' },
  { shirt: '04', name: 'Pedro Santos', position: 'Fixo' },
  { shirt: '08', name: 'Rafael Lima', position: 'Ala' },
];

function StoryPreview({ step }: { step: RegistrationStep }) {
  if (step === 1) return (
    <div className="auth-preview" aria-hidden="true">
      <div className="auth-preview-header">
        <strong><Icon name="team" size={17} /> Escalação</strong>
        <span className="auth-preview-tag is-category">SUB-12</span>
      </div>
      <ul className="auth-preview-lineup">
        {lineup.map(({ shirt, name, position }) => (
          <li key={shirt}>
            <span className="auth-preview-shirt">{shirt}</span>
            <div>
              <strong>{name}</strong>
              <span className="auth-preview-position">
                <PositionIcon position={position} tooltip={false} decorative />
                {position}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );

  if (step === 2) return (
    <div className="auth-preview" aria-hidden="true">
      <div className="auth-preview-header">
        <strong><Icon name="ball" size={17} /> Partida</strong>
        <span className="auth-preview-tag is-live">Ao vivo</span>
      </div>
      <div className="auth-preview-scoreboard">
        <span className="auth-preview-team"><span><Icon name="shield" size={20} /></span>Ludora FC</span>
        <strong>2 <span>–</span> 1</strong>
        <span className="auth-preview-team"><span><Icon name="shield" size={20} /></span>União Futsal</span>
      </div>
      <div className="auth-preview-event">
        <span><Icon name="ball" size={15} /> Gol do Ludora FC</span>
        <span>2º tempo</span>
      </div>
    </div>
  );

  return (
    <div className="auth-preview" aria-hidden="true">
      <div className="auth-preview-header">
        <strong><Icon name="radar" size={17} /> Scout do atleta</strong>
      </div>
      <div className="auth-preview-athlete">
        <span className="auth-preview-shirt">#8</span>
        <span><strong>Rafael Lima</strong><small>Ala · SUB-12</small></span>
        <span className="auth-preview-tag is-profile">Armador</span>
      </div>
      <dl className="auth-preview-stats">
        <div><dt>Jogos</dt><dd>8</dd></div>
        <div><dt>Gols</dt><dd>5</dd></div>
        <div><dt>Assistências</dt><dd>12</dd></div>
      </dl>
    </div>
  );
}

export function AuthStory({ step }: { step?: RegistrationStep }) {
  const story = step ? features[step] : {
    title: 'Seu clube.',
    accent: 'Seu jogo.',
    description: 'Organize a rotina do clube, acompanhe partidas e consulte o Scout dos atletas.',
  };

  return (
    <aside className="auth-story" aria-label="Conheça o Ludora">
      <Brand />
      <div className="auth-story-court" aria-hidden="true">
        <span />
      </div>
      <div className="auth-story-content" key={step}>
        <h2>{story.title}<br /><span>{story.accent}</span></h2>
        <p>{story.description}</p>
        {step && <StoryPreview step={step} />}
      </div>
    </aside>
  );
}

export function MobileAuthStory({ step }: { step: RegistrationStep }) {
  const story = features[step];

  return (
    <aside className="auth-story-mobile" aria-label="Conheça o Ludora" key={step}>
      <span className="auth-story-mobile-icon"><Icon name={story.icon} size={18} /></span>
      <div>
        <h2>{story.title} {story.accent}</h2>
        <p>{story.description}</p>
      </div>
    </aside>
  );
}
