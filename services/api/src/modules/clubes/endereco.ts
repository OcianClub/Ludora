export type EnderecoClube = { logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; estado: string; cep: string };
export function lerEndereco(value: unknown): EnderecoClube | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Endereço inválido.');
  const input = value as Record<string,unknown>;
  const data = Object.fromEntries(['logradouro','numero','complemento','bairro','cidade','estado','cep'].map(key => [key, typeof input[key] === 'string' ? input[key].trim() : ''])) as EnderecoClube;
  if (!data.logradouro || !data.cidade || !/^[A-Z]{2}$/.test(data.estado) || !/^\d{8}$/.test(data.cep.replace(/\D/g,'')) || Object.values(data).some(text => text.length > 160 || /\p{Extended_Pictographic}/u.test(text))) throw new Error('Informe logradouro, cidade, UF e CEP de oito dígitos, sem emojis.');
  data.cep = data.cep.replace(/\D/g,'');
  return data;
}
export function formatarEndereco(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const data = value as Partial<EnderecoClube>;
  return [data.logradouro, data.numero, data.bairro, data.cidade, data.estado, data.cep].filter(Boolean).join(', ');
}
