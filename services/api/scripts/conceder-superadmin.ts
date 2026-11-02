import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  if (process.argv.length !== 3 || !/^\S+@\S+\.\S+$/.test(email)) {
    console.error('Uso: pnpm superadmin:grant email-da-conta-existente');
    process.exitCode = 1;
    return;
  }

  const usuario = await prisma.usuario.update({
    where: { email },
    data: { papel_plataforma: 'SUPERADMIN' },
    select: { id: true },
  });
  console.log(`Papel SUPERADMIN concedido ao usuário #${usuario.id}. A conta pode acessar o desktop.`);
}

main().catch(error => {
  console.error((error as { code?: string })?.code === 'P2025'
    ? 'Conta não encontrada. Cadastre a conta antes de conceder o papel.'
    : 'Não foi possível conceder o papel. Confira o e-mail, a conexão e se a migration foi aplicada.');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
