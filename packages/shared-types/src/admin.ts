// Contrato do painel Super Admin (rotas /admin da API, consumidas pelo desktop).
// A API tem rootDir próprio e não importa este arquivo: se mudar o formato de
// uma resposta em services/api/src/modules/admin, atualize aqui também.

export type PapelClube = 'ADMIN' | 'TECNICO' | 'MESARIO' | 'TORCEDOR' | 'OLHEIRO';
export type PlanoClube = 'FREE' | 'DEMO' | 'TRIAL' | 'PRO';
export type NivelLog = 'info' | 'warn' | 'error' | 'audit';

export interface SuperAdminUsuario {
  id: number;
  nome: string;
  email: string;
}

export interface ClubeResumo {
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
  categorias: { id: number; nome: string }[];
  membros: MembroClube[];
}

export interface DefinirPapel {
  papel: PapelClube;
  acesso_todas_categorias?: boolean;
  categoria_ids?: number[];
}

export interface UsuarioGlobal {
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
  id: number;
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
