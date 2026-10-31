export const CLUB_STATES = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

export const EMPTY_CLUB_ADDRESS = {
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  cep: '',
};

export type ClubAddress = typeof EMPTY_CLUB_ADDRESS;
export type ClubForm = { nome: string; escudo?: string | null; endereco: ClubAddress | null };
export type ClubFormErrors = Partial<Record<'nome' | 'escudo' | keyof ClubAddress, string>>;

export function formatClubCep(value: string) {
  return value.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
}

export function normalizeClubForm(value: ClubForm) {
  const address = Object.fromEntries(Object.entries({ ...EMPTY_CLUB_ADDRESS, ...value.endereco })
    .map(([key, text]) => [key, key === 'cep' ? text.replace(/\D/g, '') : text.trim()])) as ClubAddress;
  return {
    nome: value.nome.trim(),
    escudo: value.escudo?.trim() || null,
    endereco: Object.values(address).some(Boolean) ? address : null,
  };
}

export function validateClubForm(value: ClubForm): ClubFormErrors {
  const form = normalizeClubForm(value);
  const errors: ClubFormErrors = {};
  if (!form.nome) errors.nome = 'Informe o nome do clube.';
  else if (form.nome.length > 120 || /\p{Extended_Pictographic}/u.test(form.nome)) errors.nome = 'Use até 120 caracteres, sem emojis.';
  if (form.escudo && !(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(form.escudo)
    ? form.escudo.length <= 180000 : /^https:\/\/[^\s]+$/i.test(form.escudo) && form.escudo.length <= 2000)) {
    errors.escudo = 'Selecione uma imagem válida ou informe um link HTTPS.';
  }
  if (form.endereco) {
    if (!form.endereco.logradouro) errors.logradouro = 'Informe a rua ou avenida da sede.';
    if (!form.endereco.cidade) errors.cidade = 'Informe a cidade da sede.';
    if (!CLUB_STATES.includes(form.endereco.estado)) errors.estado = 'Selecione uma UF válida.';
    if (!/^\d{8}$/.test(form.endereco.cep)) errors.cep = 'Informe um CEP com 8 dígitos.';
    for (const [key, text] of Object.entries(form.endereco)) {
      if (text.length > 160 || /\p{Extended_Pictographic}/u.test(text)) errors[key as keyof ClubAddress] = 'Use até 160 caracteres, sem emojis.';
    }
  }
  return errors;
}

export async function prepareClubCrest(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Escolha uma imagem PNG, JPG ou WebP.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Escolha uma imagem de até 8 MB.');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('Não foi possível abrir essa imagem. Tente outro arquivo.'); }
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar o escudo neste navegador.');
    for (const edge of [512, 384, 256]) {
      const ratio = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const png = canvas.toDataURL('image/png');
      if (png.length <= 180000) return png;
      const webp = canvas.toDataURL('image/webp', .85);
      if (webp.length <= 180000) return webp;
    }
    throw new Error('Não foi possível reduzir essa imagem. Escolha um arquivo mais leve.');
  } finally { bitmap.close(); }
}
