import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { JWT_SECRET } from '../../config/env';

// Chave separada por finalidade. O hash continua sendo a credencial de aceite.
const chave = () => Buffer.from(hkdfSync('sha256', JWT_SECRET, 'ludora', 'convite-codigo-v1', 32));
export function cifrarCodigo(codigo: string, clubeId: number): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', chave(), nonce);
  cipher.setAAD(Buffer.from(String(clubeId)));
  const data = Buffer.concat([cipher.update(codigo, 'utf8'), cipher.final()]);
  return ['v1', nonce.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}
export function decifrarCodigo(valor: string, clubeId: number): string | null {
  try {
    const [version, nonce, tag, data, extra] = valor.split('.');
    if (version !== 'v1' || extra || !nonce || !tag || !data) return null;
    const decipher = createDecipheriv('aes-256-gcm', chave(), Buffer.from(nonce, 'base64url'));
    decipher.setAAD(Buffer.from(String(clubeId)));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  } catch { return null; }
}
