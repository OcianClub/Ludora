export function mandoDoClube(times: {id:number;clube_representado_id:number|null}[], mandanteId:number, visitanteId:number, clubeId:number): boolean {
  const mandante = times.find(t=>t.id===mandanteId);
  const visitante = times.find(t=>t.id===visitanteId);
  if (!mandante || !visitante || mandanteId===visitanteId || Number(mandante.clube_representado_id===clubeId)+Number(visitante.clube_representado_id===clubeId)!==1) {
    throw new Error('O confronto deve conter exatamente um time vinculado ao clube ativo e um adversário. Confira o cadastro dos times.');
  }
  return mandante.clube_representado_id===clubeId;
}
