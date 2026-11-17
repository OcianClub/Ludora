export interface ContextoOrganizacao {
  recentes: { timeId: number; clubeId: number | null; nome: string; data: string }[];
  ultimoLocalCasa: { local: string; partidaId: number } | null;
}
export interface ConflitoOrganizacao {
  conflito: boolean;
  mensagem: string;
  partidaId: number | null;
  propostaId: string | null;
}
