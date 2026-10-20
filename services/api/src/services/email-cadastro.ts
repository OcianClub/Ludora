import { Resend } from 'resend';

export async function enviarEmailCadastro(email: string, codigo: string) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const formatado = `${codigo.slice(0, 4)}-${codigo.slice(4)}`;
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: email,
    subject: 'Confirme seu e-mail no Ludora',
    text: [
      'Falta pouco para criar sua conta no Ludora.',
      `Seu código de confirmação: ${formatado}`,
      'Volte ao aplicativo e informe este código. Ele vale por 15 minutos e só pode ser usado uma vez.',
      'Se você não iniciou este cadastro, ignore a mensagem. Nenhuma conta foi criada.',
      'Nunca compartilhe este código.',
    ].join('\n\n'),
    html: `<!doctype html>
      <html lang="pt-BR">
        <body style="margin:0;background:#0B0D12;font-family:Arial,Helvetica,sans-serif;color:#F2E9D8;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr><td align="center" style="padding:32px 16px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#14171F;border:1px solid #2A3040;border-radius:12px;">
                <tr><td style="padding:32px;">
                  <p style="color:#0E78FF;font-weight:bold;letter-spacing:2px;">LUDORA</p>
                  <h1 style="font-size:26px;line-height:1.3;">Confirme seu e-mail</h1>
                  <p style="color:#B7B8BD;line-height:1.6;">Falta pouco para criar sua conta. Volte ao aplicativo e informe o código abaixo:</p>
                  <p style="padding:20px;background:#091526;border:1px solid #1E4C88;border-radius:8px;font-family:monospace;font-size:28px;text-align:center;letter-spacing:4px;">${formatado}</p>
                  <p style="color:#B7B8BD;line-height:1.6;">Válido por <strong>15 minutos</strong>, para um único uso. Nunca compartilhe este código.</p>
                  <p style="padding-top:20px;border-top:1px solid #2A3040;color:#8B8D94;font-size:13px;line-height:1.6;">Se você não iniciou este cadastro, ignore a mensagem. Nenhuma conta foi criada.</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
      </html>`,
  });
  if (error) throw new Error('O provedor não confirmou o envio do e-mail.');
}
