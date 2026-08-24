export type PapelConvite = 'ADMIN' | 'TECNICO' | 'MESARIO';

export interface CategoriaConvite {
  id: number;
  nome: string;
  tipo?: 'INICIACAO' | 'BASE';
}

export interface ClubeConvite {
  id: number;
  nome: string;
  escudo: string | null;
  cidade?: string | null;
  estado?: string | null;
}

export interface ConviteConsultado {
  id: string;
  email: string;
  possui_conta: boolean;
  papel: PapelConvite;
  acesso_todas_categorias: boolean;
  expira_em: string;
  clube: ClubeConvite;
  convidado_por: string;
  categorias: CategoriaConvite[];
}

export interface ResultadoConvite {
  mensagem: string;
  token?: string;
  usuario: {
    id: number;
    nome: string;
    email: string;
    criadoEm?: string;
  };
  clube: ClubeConvite & {
    papel: PapelConvite;
    acesso_todas_categorias: boolean;
    categorias: CategoriaConvite[];
  };
}
