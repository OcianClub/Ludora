// Remove apenas o sufixo esportivo legado, sem alterar o registro no banco.
export function teamName(name: string) {
  return name.normalize('NFKC').replace(/\s*[-–—·(]?\s*sub[\s-]*\d{1,2}\)?\s*$/i, '').trim().replace(/\s+/g, ' ');
}
export function teamKey(name: string) { return teamName(name).toLocaleLowerCase('pt-BR'); }
