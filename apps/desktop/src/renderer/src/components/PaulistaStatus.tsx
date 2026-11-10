/** Estado informado pela integração, com cor somente no indicador. */
export function PaulistaStatus({ state, label }: { state: string; label: string }) {
  const tone = ['ERRO'].includes(state) ? 'error'
    : ['REVISAR_IDENTIDADE', 'ABERTA', 'EM_REVISAO', 'AGUARDANDO_CLUBE'].includes(state) ? 'warning'
    : ['ACOMPANHADO', 'CONFERIDA'].includes(state) ? 'success' : 'neutral';
  return <span className="paulista-status" data-tone={tone}><i aria-hidden="true"/>{label}</span>;
}
