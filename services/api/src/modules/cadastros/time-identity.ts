export function nomeBaseTime(nome: string) {
  return nome.normalize('NFKC').replace(/\s*[-–—·(]?\s*sub[\s-]*\d{1,2}\)?\s*$/i, '')
    .trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}
