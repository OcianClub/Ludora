export const TEMPO_ATIVAR_TROCA = 140;

type Acoes = {
  capturar: () => void;
  ativar: (ativo: boolean) => void;
  mover: (x: number, y: number) => void;
  soltar: (x: number, y: number) => void;
  tocar: () => void;
};

export function criarGestoTroca(
  acoes: Acoes,
  temporizador = {
    agendar: (acao: () => void) => setTimeout(acao, TEMPO_ATIVAR_TROCA),
    cancelar: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer),
  },
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pressionado = false;
  let ativo = false;
  let x = 0,
    y = 0;
  let moveu = false;

  function terminar(cancelado: boolean) {
    if (!pressionado) return;
    pressionado = false;
    if (timer !== undefined) temporizador.cancelar(timer);
    timer = undefined;
    const trocar = ativo && moveu && !cancelado;
    ativo = false;
    acoes.mover(0, 0);
    acoes.ativar(false);
    acoes.soltar(trocar ? x : Number.NaN, trocar ? y : Number.NaN);
    if (!cancelado && !moveu) acoes.tocar();
  }

  return {
    iniciar() {
      terminar(true);
      pressionado = true;
      ativo = false;
      moveu = false;
      x = 0;
      y = 0;
      acoes.capturar();
      timer = temporizador.agendar(() => {
        if (!pressionado) return;
        ativo = true;
        acoes.ativar(true);
        acoes.mover(x, y);
      });
    },
    mover(deltaX: number, deltaY: number) {
      if (!pressionado) return;
      x = deltaX;
      y = deltaY;
      moveu ||= Math.abs(x) + Math.abs(y) > 8;
      if (ativo) acoes.mover(x, y);
    },
    soltar() {
      terminar(false);
    },
    cancelar() {
      terminar(true);
    },
  };
}
