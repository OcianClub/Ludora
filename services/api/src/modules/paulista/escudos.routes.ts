import { Router } from 'express';
import axios from 'axios';
const placeholder = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#79838F" d="M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Zm0 3 6 3v4c0 3-4 6-6 7-2-1-6-4-6-7V8l6-3Z"/></svg>');
type Image = { body: Buffer; type: string; expires: number };
const cache = new Map<string, Image>(), inflight = new Map<string, Promise<Image>>();
export function criarEscudosPaulistaRoutes() {
  const router = Router();
  router.get('/publico/escudos/paulista/:arquivo', async (req, res) => {
    const file = String(req.params.arquivo);
    if (!/^\d{1,12}\.(png|jpe?g|webp)$/i.test(file)) { res.sendStatus(404); return; }
    const send = (image: Image) => res.type(image.type).set('Cross-Origin-Resource-Policy', 'cross-origin').set('Cache-Control', 'public, max-age=300').set('X-Content-Type-Options', 'nosniff').send(image.body);
    const saved = cache.get(file);
    if (saved && saved.expires > Date.now()) { send(saved); return; }
    if (inflight.size >= 12 && !inflight.has(file)) { send({ body: placeholder, type: 'image/svg+xml', expires: 0 }); return; }
    let task = inflight.get(file);
    if (!task) {
      task = (async (): Promise<Image> => {
        let image: Image;
        try {
          const response = await axios.get(`https://admfutsal.com.br/assets/images/foto/escudo/${file}`, {
            timeout: 5000, maxRedirects: 0, responseType: 'arraybuffer', maxContentLength: 128 * 1024,
            headers: { Referer: 'https://eventos.admfutsal.com.br/', 'User-Agent': 'Ludora/1.0' },
          });
          const type = String(response.headers['content-type']).split(';')[0];
          if (!['image/png', 'image/jpeg', 'image/webp'].includes(type)) throw Error('Invalid image');
          image = { body: Buffer.from(response.data), type, expires: Date.now() + 3600000 };
        } catch { image = { body: placeholder, type: 'image/svg+xml', expires: Date.now() + 300000 }; }
        if (cache.size >= 100) cache.delete(cache.keys().next().value!);
        cache.set(file, image); return image;
      })().finally(() => inflight.delete(file));
      inflight.set(file, task);
    }
    send(await task);
  });
  return router;
}
