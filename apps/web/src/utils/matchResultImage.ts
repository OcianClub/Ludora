import { darkColors as colors } from '../../../../packages/design-tokens/src/colors';
import logoUrl from '../../../mobile/assets/logo.svg';
import ballSvg from '../../../../packages/icons/src/svg/bola.svg?raw';
import assistSvg from '../../../../packages/icons/src/svg/chuteira.svg?raw';
import whistleSvg from '../../../../packages/icons/src/svg/apito.svg?raw';
import defenseSvg from '../../../../packages/icons/src/svg/mdi-shield-check.svg?raw';
import trophySvg from '../../../../packages/icons/src/svg/trofeu.svg?raw';
import type { matchShareModel } from './matchShare';

type Model = ReturnType<typeof matchShareModel>;

// Bound both network time and decoded image size. A failed crest uses its initial.
function loadImage(src?: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  let url: URL;
  try { url = new URL(src, location.href); } catch { return Promise.resolve(null); }
  if (!['http:', 'https:'].includes(url.protocol)) return Promise.resolve(null);
  return new Promise(resolve => {
    const image = new Image();
    const finish = (value: HTMLImageElement | null) => {
      clearTimeout(timer); image.onload = null; image.onerror = null; resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), 4000);
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    image.onload = () => finish(image.naturalWidth * image.naturalHeight <= 16_000_000 ? image : null);
    image.onerror = () => finish(null);
    image.src = url.href;
  });
}

/** Draw a standalone PNG, without capturing hidden controls, menus or private data. */
export async function renderMatchResultImage(model: Model, includeNames: boolean): Promise<Blob> {
  const [logo, home, away] = await Promise.all([loadImage(logoUrl), ...model.teams.map(team => loadImage(team.badge))]);
  await Promise.race([document.fonts?.ready, new Promise(resolve => setTimeout(resolve, 1000))]);
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  const rows = includeNames ? Math.max(1, ...model.teams.map(team => Math.min(8, team.goals.length) + (team.goals.length > 8 ? 1 : 0))) : 0;
  const competition = model.competition === 'Sem competição informada' ? '' : model.competition;
  const matchHeight = 330 + (competition ? 30 : 0) + (model.location ? 30 : 0);
  const statsTop = 126 + matchHeight + 28;
  const statsHeight = 100 + model.metrics.length * 48;
  const authorsTop = statsTop + statsHeight + 70;
  const authorsHeight = includeNames ? 126 + rows * 40 : 0;
  const highlightsTop = authorsTop + authorsHeight;
  const highlightRows = Math.max(1, ...model.highlights.map(group => Math.min(3, group.players.length)));
  const highlightHeight = model.highlights.length ? 120 + highlightRows * 84 : 0;
  canvas.height = highlightsTop + highlightHeight + 88;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível preparar a imagem neste navegador.');
  const font = (size: number, weight = 500) => { ctx.font = `${weight} ${size}px ${size >= 36 ? 'Oswald' : 'Inter'}, Arial, sans-serif`; };
  const box = (x: number, y: number, w: number, h: number, fill: string, radius = 20) => {
    ctx.fillStyle = fill; ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, radius);
    else ctx.rect(x, y, w, h);
    ctx.fill();
  };
  const text = (value: string, x: number, y: number, max: number, size = 26, color: string = colors.texto, align: CanvasTextAlign = 'left', weight = 500) => {
    font(size, weight); ctx.fillStyle = color; ctx.textAlign = align;
    let fitted = value;
    if (ctx.measureText(fitted).width > max) {
      while (fitted.length && ctx.measureText(`${fitted}…`).width > max) fitted = fitted.slice(0, -1);
      fitted += '…';
    }
    ctx.fillText(fitted, x, y);
  };
  const line = (y: number, x = 72, width = 936) => { ctx.strokeStyle = colors.borda; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + width, y); ctx.stroke(); };
  // Reuse the site's event drawings. These bundled SVGs contain filled paths only.
  const drawings = new Map<string, { view: number[]; paths: Path2D[] }>();
  const icon = (svg: string, x: number, y: number, size = 26, color: string = colors.textoSecundario) => {
    let drawing = drawings.get(svg);
    if (!drawing) {
      drawing = {
        view: /viewBox="([^"]+)"/.exec(svg)![1].split(/\s+/).map(Number),
        paths: [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map(match => new Path2D(match[1])),
      };
      drawings.set(svg, drawing);
    }
    const [vx, vy, vw, vh] = drawing.view;
    ctx.save(); ctx.translate(x, y); ctx.scale(size / vw, size / vh); ctx.translate(-vx, -vy);
    ctx.fillStyle = color; drawing.paths.forEach(path => ctx.fill(path)); ctx.restore();
  };
  box(0, 0, 1080, canvas.height, colors.fundo, 0);
  if (logo) ctx.drawImage(logo, 60, 42, 46, 46);
  text('LUDORA', logo ? 120 : 60, 78, 350, 34, colors.texto, 'left', 800);
  text(model.title.toUpperCase(), 1020, 72, 470, 18, colors.textoSecundario, 'right');
  box(48, 126, 984, matchHeight, colors.card, 18);
  text([model.category, model.date, model.time].filter(Boolean).join(' · '), 540, 168, 890, 21, colors.textoSecundario, 'center');
  for (let i = 0; i < 2; i++) {
    const team = model.teams[i];
    const x = i === 0 ? 246 : 834;
    box(x - 48, 202, 96, 96, colors.cardSecundario, 18);
    const crest = i === 0 ? home : away;
    if (crest) {
      const scale = Math.min(76 / crest.naturalWidth, 76 / crest.naturalHeight);
      const w = crest.naturalWidth * scale, h = crest.naturalHeight * scale;
      ctx.drawImage(crest, x - w / 2, 250 - h / 2, w, h);
    } else text(team.name.trim().charAt(0).toUpperCase(), x, 266, 76, 44, colors.texto, 'center', 700);
    text(team.name, x, 336, 290, 26, colors.texto, 'center', 700);
    text(i === 0 ? 'Mandante' : 'Visitante', x, 363, 260, 18, colors.textoSecundario, 'center');
    font(82, 700);
    const scoreSize = Math.min(82, 82 * 108 / Math.max(1, ctx.measureText(String(team.score)).width));
    text(String(team.score), i === 0 ? 478 : 602, 283, 109, scoreSize, colors.texto, 'center', 700);
  }
  text('–', 540, 272, 40, 30, colors.textoSecundario, 'center');
  line(388);
  font(27, 700);
  const outcomeWidth = Math.min(828, ctx.measureText(model.outcome).width);
  icon(trophySvg, 540 - (outcomeWidth + 40) / 2, 405, 27, colors.primaria);
  text(model.outcome, 560, 428, 828, 27, colors.texto, 'center', 700);
  let metaY = 461;
  if (competition) { text(competition, 540, metaY, 880, 20, colors.textoSecundario, 'center'); metaY += 30; }
  if (model.location) text(model.location, 540, metaY, 880, 19, colors.textoSecundario, 'center');

  box(48, statsTop, 984, statsHeight, colors.card, 18);
  text('REGISTROS DA PARTIDA', 540, statsTop + 36, 580, 18, colors.textoSecundario, 'center', 600);
  text(model.teams[0].name, 84, statsTop + 36, 220, 20, colors.texto, 'left', 600);
  text(model.teams[1].name, 996, statsTop + 36, 220, 20, colors.texto, 'right', 600);
  line(statsTop + 56, 80, 920);
  const eventIcons: Record<string, string> = { Gols: ballSvg, 'Assistências': assistSvg, Defesas: defenseSvg, 'Faltas cometidas': whistleSvg };
  const cardColors: Record<string, string> = { Amarelos: colors.amarelo, Vermelhos: colors.vermelho, Azuis: colors.primaria };
  model.metrics.forEach((metric, index) => {
    const y = statsTop + 94 + index * 48;
    text(String(metric.values[0]), 106, y, 100, 27, colors.texto, 'center', 700);
    text(String(metric.values[1]), 974, y, 100, 27, colors.texto, 'center', 700);
    const label = metric.label === 'Faltas cometidas' ? 'Faltas' : metric.label;
    font(22);
    const width = ctx.measureText(label).width + 38, x = 540 - width / 2;
    if (eventIcons[metric.label]) icon(eventIcons[metric.label], x, y - 21, 26);
    else box(x + 5, y - 20, 16, 22, cardColors[metric.label] || colors.textoSecundario, 3);
    text(label, x + 38, y - 1, 450, 22, colors.textoSecundario);
    if (index < model.metrics.length - 1) line(y + 16, 84, 912);
  });
  text('Eventos registrados na súmula. Não representam todos os lances do jogo.', 60, statsTop + statsHeight + 31, 960, 17, colors.textoSecundario);
  if (includeNames) {
    icon(ballSvg, 60, authorsTop - 4, 25, colors.primaria);
    text('AUTORES DOS GOLS', 96, authorsTop + 16, 900, 20, colors.texto, 'left', 600);
    model.teams.forEach((team, index) => {
      const x = index === 0 ? 60 : 560;
      text(team.name, x, authorsTop + 57, 450, 22, colors.texto, 'left', 700);
      if (!team.goals.length) text('Sem autoria de gol registrada.', x, authorsTop + 95, 450, 19, colors.textoSecundario);
      team.goals.slice(0, 8).forEach((goal, row) => {
        text(`${goal.count}×`, x, authorsTop + 95 + row * 40, 48, 22, colors.texto, 'left', 700);
        text(`${goal.name}${goal.own ? ' (contra)' : ''}`, x + 46, authorsTop + 95 + row * 40, 404, 20);
      });
      if (team.goals.length > 8) text(`+${team.goals.length - 8} autores na súmula`, x, authorsTop + 95 + 8 * 40, 450, 18, colors.textoSecundario);
    });
    if (model.teams.some(team => team.goals.some(goal => goal.own))) {
      text('Gol contra aparece no time beneficiado.', 60, highlightsTop - 25, 950, 17, colors.textoSecundario);
    }
  }
  if (model.highlights.length) {
    const top = highlightsTop;
    text('DESTAQUES NOS REGISTROS · LUDORA', 60, top + 18, 950, 20, colors.texto, 'left', 600);
    const gap = 20, cardWidth = (960 - gap * (model.highlights.length - 1)) / model.highlights.length;
    model.highlights.forEach((group, index) => {
      const x = 60 + index * (cardWidth + gap), y = top + 40;
      box(x, y, cardWidth, 80 + highlightRows * 84, colors.card, 14);
      icon(index === 0 ? ballSvg : defenseSvg, x + 18, y + 19, 23, colors.primaria);
      text(group.label, x + 52, y + 37, cardWidth - 70, 19, colors.texto, 'left', 600);
      if (!group.players.length) text('Sem registros', x + 18, y + 94, cardWidth - 36, 19, colors.textoSecundario);
      group.players.slice(0, 3).forEach((player, row) => {
        const py = y + 67 + row * 84;
        box(x + 18, py - 4, 42, 42, colors.cardSecundario, 7);
        text(String(player.shirt).padStart(2, '0'), x + 39, py + 25, 36, 23, colors.texto, 'center', 700);
        text(player.name, x + 72, py + 13, cardWidth - 90, 20, colors.texto, 'left', 700);
        text(player.team, x + 72, py + 36, cardWidth - 90, 16, colors.textoSecundario);
        text(player.detail, x + 72, py + 58, cardWidth - 90, 17, colors.texto);
      });
      if (group.players.length > 1) {
        const message = group.players.length > 3 ? `+${group.players.length - 3} atletas empatados na súmula` : `${group.players.length} atletas empatados`;
        text(message, x + 18, y + 61 + highlightRows * 84, cardWidth - 36, 16, colors.textoSecundario);
      }
    });
  }
  text(model.annotation ? 'Anotações do clube · resultado oficial na federação' : 'LUDORA · Acompanhe a súmula completa no site', 540, canvas.height - 33, 950, 17, colors.textoSecundario, 'center');
  return new Promise((resolve, reject) => {
    try { canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não foi possível gerar o PNG.')), 'image/png'); }
    catch { reject(new Error('Não foi possível exportar a imagem. Tente novamente.')); }
  });
}
