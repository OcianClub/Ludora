export interface EquipePaulista { id: number; nome: string; escudo: string | null }
export interface JogoPaulista {
  id: string; faseId: string; fase: string; sumulaId: number | null;
  mandanteId: number; visitanteId: number; data: string | null; horario: string | null;
  local: string | null; golsMandante: number | null; golsVisitante: number | null;
  ocorrencia: 'WO' | 'ADIADA' | null;
}
export interface PosicaoPaulista {
  faseId: string; fase: string; grupo: string; equipeId: number; posicao: number;
  pontos: number; jogos: number; vitorias: number; empates: number; derrotas: number;
  golsPro: number; golsContra: number; saldo: number; pontosNota?: string;
}
export interface SnapshotPaulista {
  id: number; ano: number; titulo: 'Paulista'; divisao: string; categoria: string;
  fonte: string; equipes: EquipePaulista[]; jogos: JogoPaulista[];
  classificacao: PosicaoPaulista[]; avisos: string[]; fasesExcluidas: string[];
}
export interface PainelPaulista {
  evento: { id: number; versao: number; consultadoEm: string; verificadoEm: string | null; diario: boolean };
  snapshot: SnapshotPaulista;
  vinculos: { equipeId: number; clubeId: number; nome: string; escudo?: string | null }[];
  jogosLocais: { id: string; partidaId: number | null; status?: 'AGENDADA' | 'PREPARADA' | 'AO_VIVO' | 'FINALIZADA' | 'CANCELADA' }[];
  pendencias: { id: number; jogoId: string; tipo: string; estado: string; dados: any }[];
  retroativos: { id: number; acao: string; criadoEm: string; dados: any }[];
}
