import { useId } from 'react';
import type {
  PartidaScout,
  TotaisContextoScout,
} from '../../../mobile/src/utils/contextoScout';

export const SCOUT_CHART_METRICS = [
  { key: 'gols', label: 'Gols', className: 'goals' },
  { key: 'assistencias', label: 'Assist.', className: 'assists' },
  { key: 'defesas', label: 'Defesas', className: 'saves' },
] as const;

export function ScoutRecordsRadar({ totals }: { totals: TotaisContextoScout }) {
  const titleId = useId();
  const metrics = [
    { label: 'Gols', value: totals.gols },
    { label: 'Assist.', value: totals.assistencias },
    { label: 'Defesas', value: totals.defesas },
    { label: 'Faltas', value: totals.faltas },
    {
      label: 'Cartões',
      value: totals.amarelos + totals.vermelhos + totals.azuis,
    },
  ];
  const maximum = Math.max(1, ...metrics.map((m) => m.value));
  const point = (index: number, radius: number) => {
    const angle = (index * 2 * Math.PI) / metrics.length - Math.PI / 2;
    return [180 + Math.cos(angle) * radius, 132 + Math.sin(angle) * radius];
  };
  const polygon = (radius: number) =>
    metrics.map((_, index) => point(index, radius).join(',')).join(' ');
  return (
    <figure className="athlete-radar">
      <svg viewBox="0 0 360 270" role="img" aria-labelledby={titleId}>
        <title id={titleId}>
          Radar de eventos:{' '}
          {metrics.map((m) => `${m.label} ${m.value}`).join(', ')}. Escala de 0
          a {maximum} registros.
        </title>
        {[0.25, 0.5, 0.75, 1].map((step) => (
          <polygon
            key={step}
            points={polygon(84 * step)}
            className="athlete-radar-grid"
          />
        ))}
        {metrics.map((m, index) => {
          const [x, y] = point(index, 84);
          const [labelX, labelY] = point(index, 114);
          return (
            <g key={m.label}>
              <line
                x1="180"
                y1="132"
                x2={x}
                y2={y}
                className="athlete-radar-grid"
              />
              <text
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {m.label}
                <tspan x={labelX} dy="17" className="athlete-radar-value">
                  {m.value}
                </tspan>
              </text>
            </g>
          );
        })}
        <polygon
          points={metrics
            .map((m, index) => point(index, (84 * m.value) / maximum).join(','))
            .join(' ')}
          className="athlete-radar-data"
        />
        {metrics.map((m, index) => {
          const [x, y] = point(index, (84 * m.value) / maximum);
          return (
            <circle
              key={m.label}
              cx={x}
              cy={y}
              r="3"
              className="athlete-radar-dot"
            />
          );
        })}
      </svg>
      <figcaption>
        Escala: 0–{maximum} eventos. Volume de registros, não nota de
        desempenho.
      </figcaption>
    </figure>
  );
}

export function ScoutRecentChart({
  matches,
  onSelect,
}: {
  matches: PartidaScout[];
  onSelect: (id: number) => void;
}) {
  const recent = matches.slice(0, 10).reverse();
  const maximum = Math.max(
    1,
    ...recent.map((p) => p.gols + p.assistencias + p.defesas),
  );
  return (
    <div className="athlete-trend">
      <div className="athlete-chart-legend" aria-hidden="true">
        {SCOUT_CHART_METRICS.map((m) => (
          <span key={m.key}>
            <i className={`athlete-color-${m.className}`} />
            {m.label}
          </span>
        ))}
      </div>
      <div className="athlete-trend-scroll">
        <div
          className="athlete-trend-bars"
          role="group"
          aria-label="Eventos por partida, da mais antiga para a mais recente"
        >
          {recent.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              aria-label={`${p.adversario}, ${p.data.slice(8, 10)}/${p.data.slice(5, 7)}: ${p.gols} gols, ${p.assistencias} assistências e ${p.defesas} defesas. Ver partida.`}
            >
              <span className="athlete-trend-stack" aria-hidden="true">
                <b>{p.gols + p.assistencias + p.defesas}</b>
                {SCOUT_CHART_METRICS.map((m) => (
                  <i
                    key={m.key}
                    className={`athlete-color-${m.className}`}
                    style={{ height: `${(p[m.key] / maximum) * 100}%` }}
                  />
                ))}
              </span>
              <span>
                {p.data.slice(8, 10)}/{p.data.slice(5, 7)}
              </span>
            </button>
          ))}
        </div>
      </div>
      <p className="athlete-note">
        Mais recente à direita · toque nas barras para detalhar.
      </p>
    </div>
  );
}
