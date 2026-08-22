import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

function escaparHtml(valor: string): string {
  return valor.replace(/[&<>'"]/g, caractere => {
    const entidades: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };

    return entidades[caractere];
  });
}

interface EnviarConviteParams {
  email: string;
  nomeClube: string;
  nomeConvidante: string;
  token: string;
  codigo: string;
}

export async function enviarEmailConvite({
  email,
  nomeClube,
  nomeConvidante,
  token,
  codigo,
}: EnviarConviteParams) {
  const remetente = process.env.EMAIL_FROM;
  const baseUrl = process.env.INVITE_BASE_URL;

  if (!remetente || !baseUrl) {
    throw new Error('Configuração de e-mail incompleta');
  }

  const link = `${baseUrl}/${encodeURIComponent(token)}`;
  const clubeSeguro = escaparHtml(nomeClube);
  const convidanteSeguro = escaparHtml(nomeConvidante);
  const linkSeguro = escaparHtml(link);
  const codigoSeguro = escaparHtml(codigo);

  const { data, error } = await resend.emails.send({
    from: remetente,
    to: email,
    subject: `Convite para participar do ${nomeClube}`,
    text: [
      `Olá!`,
      '',
      `${nomeConvidante} convidou você para participar do ${nomeClube} no Ludora.`,
      '',
      `Código para usar no aplicativo: ${codigo}`,
      '',
      `Acesse o convite: ${link}`,
      '',
      `Este convite possui prazo de validade.`,
      `Caso não reconheça o convite, ignore este e-mail.`,
    ].join('\n'),
    html: `
      <!doctype html>
      <html lang="pt-BR">
        <body style="margin:0; padding:0; background-color:#0B0D12; color:#F2E9D8; font-family:Arial, Helvetica, sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0B0D12; padding:40px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#14171F; border:1px solid #2A3040; border-radius:16px; overflow:hidden;">
                  <tr>
                    <td style="height:4px; background-color:#0E78FF;"></td>
                  </tr>

                  <tr>
                    <td style="padding:36px 36px 20px;">
                      <p style="margin:0 0 8px; color:#0E78FF; font-size:13px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase;">
                        Ludora
                      </p>
                      <h1 style="margin:0; color:#F2E9D8; font-size:26px; line-height:1.3;">
                        Você recebeu um convite
                      </h1>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:0 36px;">
                      <p style="margin:0 0 22px; color:#B7B8BD; font-size:16px; line-height:1.6;">
                        <strong style="color:#F2E9D8;">${convidanteSeguro}</strong> convidou você para fazer parte do clube <strong style="color:#F2E9D8;">${clubeSeguro}</strong> no Ludora.
                      </p>

                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 26px; background-color:#1B1E27; border:1px solid #2A3040; border-radius:10px;">
                        <tr>
                          <td style="padding:18px 20px;">
                            <p style="margin:0 0 5px; color:#8B8D94; font-size:12px; font-weight:700; letter-spacing:1px; text-transform:uppercase;">
                              Clube
                            </p>
                            <p style="margin:0; color:#F2E9D8; font-size:17px; font-weight:700;">
                              ${clubeSeguro}
                            </p>
                          </td>
                        </tr>
                      </table>

                      <p style="margin:0 0 10px; color:#B7B8BD; font-size:14px; line-height:1.6;">
                        No aplicativo Ludora, acesse a opção de entrar com um convite e informe este código:
                      </p>

                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 26px; background-color:#091526; border:1px solid #1E4C88; border-radius:10px;">
                        <tr>
                          <td align="center" style="padding:18px 20px;">
                            <p style="margin:0; color:#F2E9D8; font-family:'Courier New', Courier, monospace; font-size:26px; font-weight:700; letter-spacing:4px;">
                              ${codigoSeguro}
                            </p>
                          </td>
                        </tr>
                      </table>

                      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                        <tr>
                          <td align="center" bgcolor="#0E78FF" style="border-radius:10px;">
                            <a href="${linkSeguro}" target="_blank" style="display:inline-block; padding:15px 28px; color:#FFFFFF; font-size:14px; font-weight:700; line-height:1; text-decoration:none; text-transform:uppercase;">
                              Visualizar convite
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin:0 0 10px; color:#8B8D94; font-size:13px; line-height:1.6;">
                        Este convite possui prazo de validade. Se o botão não funcionar, copie e cole o endereço abaixo no navegador:
                      </p>
                      <p style="margin:0 0 30px; color:#0E78FF; font-size:12px; line-height:1.6; word-break:break-all;">
                        ${linkSeguro}
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:20px 36px; border-top:1px solid #2A3040;">
                      <p style="margin:0; color:#8B8D94; font-size:12px; line-height:1.6;">
                        Se você não reconhece este convite, ignore esta mensagem. Nenhuma conta será criada sem a sua confirmação.
                      </p>
                    </td>
                  </tr>
                </table>

                <p style="margin:18px 0 0; color:#62656D; font-size:11px;">
                  Ludora — gestão e estatísticas de clubes
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  });

  if (error) {
    throw new Error(`Erro ao enviar e-mail: ${error.message}`);
  }

  return data;
}
