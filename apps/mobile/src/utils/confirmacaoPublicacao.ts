type SumulaAuditavel = {
  auditoria?: { dados?: Record<string, unknown> | null }[];
};

/** Um timeout não comprova falha: a transação pode ter sido confirmada no servidor. */
export async function enviarComConfirmacao<T extends SumulaAuditavel>(
  requestId: string,
  enviar: () => Promise<unknown>,
  consultar: () => Promise<T | undefined>,
): Promise<T | undefined> {
  try {
    await enviar();
  } catch (erro) {
    const recente = await consultar().catch(() => undefined);
    if (recente?.auditoria?.some(a => a.dados?.request_id === requestId)) {
      return recente;
    }
    // Nunca deduzir sucesso por placar: outro operador pode ter registrado um lance.
    throw erro;
  }
  return undefined;
}
