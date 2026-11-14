// Contrato do painel Super Admin (rotas /admin da API, consumidas pelo desktop).
// A API tem rootDir próprio e não importa este arquivo: se mudar o formato de
// uma resposta em services/api/src/modules/admin, atualize aqui também.

export type PapelClube = 'ADMIN' | 'TECNICO' | 'MESARIO' | 'TORCEDOR' | 'OLHEIRO';
export type PapelPlataforma = 'USUARIO' | 'SUPERADMIN' | 'SUPORTE' | 'DESENVOLVEDOR';
export type PlanoClube = 'FREE' | 'DEMO' | 'TRIAL' | 'PRO';
export type NivelLog = 'info' | 'warn' | 'error' | 'audit';

export interface PartidaRevisao {
  id: number; data: string; horario: string | null; organizador_id: number | null; inicioAoVivo: string | null;
  mandante: { nome: string; escudo: string | null }; visitante: { nome: string; escudo: string | null };
  categoria: { nome: string; clube_id: number };
}
export interface ResumoOperacional {
  consultadoEm: string;
  chamados: { abertos: number; atrasados: number } | null;
  manutencao: number | null;
  federacao: { pendencias: number; falhas: number; erroRotina: boolean } | null;
  antigas: PartidaRevisao[] | null;
  semInicio: PartidaRevisao[] | null;
}

export interface SuperAdminUsuario {
  papel_plataforma: Exclude<PapelPlataforma, 'USUARIO'>;
  id: number;
  nome: string;
  email: string;
}

export type EnderecoCadastro = { cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; estado: string };

export interface ClubeResumo {
  ativo: boolean;
  cnpj: string | null;
  endereco: EnderecoCadastro | null;
  id: number;
  nome: string;
  escudo: string | null;
  cidade: string | null;
  estado: string | null;
  plano: string;
  criado_em: string;
  membros: number;
  categorias: number;
  competicoes: number;
  jogadores: number;
  partidas: number;
}

export interface VisaoGlobal {
  totais: { clubes: number; usuarios: number; jogadores: number; partidas: number; partidasAoVivo: number };
  conexoes: { principal: number; admin: number };
  clubes: ClubeResumo[];
}

export interface NovoClube {
  casca_id?: number;
  casca_ids?: number[];
  /** Agrupamento visual confirmado pelo operador, sem fundir os Times originais. */
  casca_agrupada?: boolean;
  cnpj: string;
  endereco: EnderecoCadastro;
  escudo_arquivo?: string | null;
  subs: number[];
  nome: string;
  cidade?: string;
  estado?: string;
  plano?: PlanoClube;
  escudo?: string;
  admin_email?: string;
  categorias_padrao?: boolean;
}

export interface MembroClube {
  papel: PapelClube;
  acesso_todas_categorias: boolean;
  usuario: SuperAdminUsuario;
  categorias: { categoria_id: number }[];
}

export interface MembrosDoClube {
  categorias: { id: number; nome: string; ativa: boolean; faixaIdade: number; tipo: 'INICIACAO' | 'BASE' }[];
  membros: MembroClube[];
}

export interface DefinirPapel {
  papel: PapelClube;
  acesso_todas_categorias?: boolean;
  categoria_ids?: number[];
}

export interface UsuarioGlobal {
  suspenso: boolean;
  cargoLegado: boolean;
  papel_plataforma: PapelPlataforma;
  id: number;
  nome: string;
  email: string;
  criadoEm: string;
  superadmin: boolean;
  clubes: { clube_id: number; nome: string; papel: PapelClube }[];
}

export interface StatusBanco {
  conectado: boolean;
  latenciaMs: number;
  versaoPostgres: string;
  horaServidor: string;
  migracoes: { aplicadas: number; locais: number | null; pendentes: string[] | null; falhas: string[] };
  tabelas: Record<string, number>;
}

export interface StatusSistema {
  ambiente: string;
  node: string;
  uptimeSegundos: number;
  memoriaMB: number;
  integracoes: {
    scoutIA: { configurado: boolean; acessivel: boolean | null; ms?: number };
    email: { configurado: boolean };
    supabaseStorage: { configurado: boolean };
  };
  superAdmins: number;
  conexoes: { principal: number; admin: number };
}

export interface EntradaLog {
  correlacao?: string;
  id: number;
  clubeId?: number;
  ts: string;
  nivel: NivelLog;
  tipo: 'http' | 'audit' | 'sistema';
  mensagem: string;
  metodo?: string;
  caminho?: string;
  status?: number;
  ms?: number;
  usuarioId?: number | null;
}
