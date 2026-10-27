export function fotoValida(value: unknown): value is string | null {
  return value === null || typeof value === 'string' && value.length <= 180000 && (
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ||
    value.length <= 2000 && /^https:\/\/[^\s]+$/i.test(value)
  );
}
