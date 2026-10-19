export async function lerRespostaConvite<T>(resposta: Response): Promise<T> {
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    if (resposta.status === 429) throw new Error('Muitas tentativas. Aguarde alguns instantes antes de tentar novamente.');
    if (resposta.status >= 500) throw new Error('O serviço de convites está indisponível. Tente novamente em instantes.');
    if (resposta.status === 401) throw new Error('Sua sessão expirou. Entre novamente com a conta que recebeu o convite.');
    const mensagens: Record<string, string> = {
      'Convite inválido': 'Código não encontrado. Confira os 8 caracteres ou peça um novo convite ao administrador.',
      'Este convite expirou': 'Este convite expirou. Peça ao administrador do clube um novo código.',
      'Este convite foi revogado': 'Este convite foi cancelado pelo clube. Peça um novo convite ao administrador.',
      'Este convite já foi utilizado': 'Este convite já foi aceito. Entre na sua conta para acessar o clube.',
      'Este convite pertence a outro e-mail': 'Você está usando outra conta. Entre com o e-mail que recebeu este convite.',
      'Já existe uma conta com este e-mail. Faça login para aceitar o convite.': 'Este e-mail já possui uma conta. Entre com ela para aceitar o convite.',
      'Este convite não está mais disponível': 'O convite não está mais disponível. Consulte o código novamente ou peça um novo convite.',
      'Este convite não possui categorias válidas': 'As categorias deste convite não estão disponíveis. Peça ao administrador para corrigir o convite.',
      'Este usuário já administra o clube': 'Sua conta já administra este clube. Acesse o clube pela sua conta.',
      'Este usuário já possui outro papel de gestão neste clube': 'Sua conta já tem outra função neste clube. Peça ao administrador para revisar seu acesso.',
    };
    throw new Error(mensagens[dados?.error] || 'Não foi possível concluir o convite. Confira os dados e tente novamente.');
  }
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
    throw new Error('Não conseguimos confirmar a resposta do serviço. Consulte o convite novamente.');
  }
  return dados as T;
}
