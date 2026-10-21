import { ErroConsulta, permiteConsultaLocal } from './request';

export type ResultadoConsulta<T> = {
  dados: T;
  salvoEm: number;
  origem: 'servidor' | 'local';
};
type Local<T> = { dados: T; salvoEm: number };

export async function executarConsultaComCache<T>({
  carregar,
  lerLocal,
  contextoAtual,
  salvar,
  descartar,
  onLocal,
  agora = Date.now,
}: {
  carregar: () => Promise<T>;
  lerLocal: () => Promise<Local<T> | null>;
  contextoAtual: () => Promise<boolean>;
  salvar: (dados: T) => Promise<unknown>;
  descartar: (status: number) => Promise<unknown>;
  onLocal?: (resultado: ResultadoConsulta<T>) => void;
  agora?: () => number;
}): Promise<ResultadoConsulta<T>> {
  let remotoTerminou = false;
  const remoto = carregar().then(
    (dados) => {
      remotoTerminou = true;
      return { ok: true as const, dados };
    },
    (erro) => {
      remotoTerminou = true;
      return { ok: false as const, erro };
    }
  );
  const leituraLocal = lerLocal().catch(() => null);
  void leituraLocal
    .then(async (local) => {
      if (
        local &&
        !remotoTerminou &&
        (await contextoAtual()) &&
        !remotoTerminou
      )
        onLocal?.({ ...local, origem: 'local' });
    })
    .catch(() => undefined);
  const resultado = await remoto;
  if (resultado.ok) {
    if (await contextoAtual())
      void salvar(resultado.dados).catch(() => undefined);
    return { dados: resultado.dados, salvoEm: agora(), origem: 'servidor' };
  }
  if (
    resultado.erro instanceof ErroConsulta &&
    [401, 403, 404].includes(resultado.erro.status)
  )
    await descartar(resultado.erro.status).catch(() => undefined);
  const local = permiteConsultaLocal(resultado.erro)
    ? await leituraLocal
    : null;
  if (local && permiteConsultaLocal(resultado.erro) && (await contextoAtual()))
    return { ...local, origem: 'local' };
  throw resultado.erro;
}
