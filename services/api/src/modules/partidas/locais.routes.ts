import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { formatarEndereco } from '../clubes/endereco';
import { prisma } from '../../lib/prisma';
import { exigirGestorDoClube, obterEscopoCategorias } from '../../middlewares/permissoes.middleware';
import { limitarLocais } from '../../middlewares/rate-limit.middleware';

export type LocalSuggestion = { id: string; label: string; source: 'clube' | 'local' | 'google'; detail?: string };

export async function googleSuggestions(input: string, apiKey: string, fetcher: typeof fetch = fetch): Promise<LocalSuggestion[]> {
  const response = await fetcher('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST', signal: AbortSignal.timeout(4000),
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text' },
    body: JSON.stringify({ input, includedRegionCodes: ['br'], languageCode: 'pt-BR' }),
  });
  if (!response.ok) throw new Error('Provedor indisponível');
  const body = await response.json() as { suggestions?: { placePrediction?: { placeId?: string; text?: { text?: string } } }[] };
  return (body.suggestions || []).flatMap(item => {
    const place = item.placePrediction;
    return place?.placeId && place.text?.text ? [{ id: place.placeId, label: place.text.text, source: 'google' as const }] : [];
  }).slice(0, 5);
}

const router = Router();
router.get('/locais/sugestoes', exigirGestorDoClube, limitarLocais, async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length > 160) return res.status(400).json({ error: 'Use até 160 caracteres para buscar.' });
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  res.setHeader('Cache-Control', 'no-store');
  try {
    const clubeId = (req as any).clubeId as number;
    const scope = await obterEscopoCategorias((req as any).usuarioId, clubeId);
    const clubs = await prisma.clube.findMany({ where:{endereco:{not:Prisma.DbNull}}, select:{id:true,nome:true,endereco:true}, orderBy:{nome:'asc'}, take:100 });
    const rows = await prisma.partida.findMany({
      where: { categoria: { clube_id: clubeId }, local: { not: null, contains: q, mode: 'insensitive' },
        ...(scope.acessoTotal ? {} : { categoria_id: { in: scope.categoriaIds } }) },
      distinct: ['local'], select: { local: true }, orderBy: { local: 'asc' }, take: 6,
    });
    const normalized = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
    const items: LocalSuggestion[] = clubs.filter(club => !!formatarEndereco(club.endereco) && normalized(`${club.nome} ${formatarEndereco(club.endereco)}`).includes(normalized(q))).sort((a,b) => Number(b.id === clubeId)-Number(a.id === clubeId)).slice(0,6).map(club=>({id:`clube:${club.id}`,label:formatarEndereco(club.endereco),source:'clube',detail:club.id===clubeId?`Sede do ${club.nome} · seu clube`:`${club.nome} · Clube Ludora`}));
    items.push(...rows.filter(row => row.local?.trim() && !items.some(item=>normalized(item.label)===normalized(row.local!))).map(row => ({ id: `local:${row.local}`, label: row.local!, source: 'local' as const })));
    let unavailable = false;
    if (key && q.length >= 3) {
      try {
        const google = await googleSuggestions(q, key);
        items.push(...google.filter(item => !items.some(local => local.label.toLocaleLowerCase() === item.label.toLocaleLowerCase())));
      } catch { unavailable = true; }
    }
    return res.json({ items, providerEnabled: !!key, unavailable });
  } catch { return res.status(500).json({ error: 'Não foi possível buscar locais. Você pode digitar o endereço manualmente.' }); }
});
export default router;
