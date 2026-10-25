import { useState } from 'react';
import { Brand } from '@web/components/Brand';
import { ThemeToggle } from '@web/components/ThemeToggle';
import { PasswordInput } from '@web/components/PasswordInput';
import { Input } from '@web/components/UI';
import { useAdminAuth } from '../contexts/AdminAuthContext';

// Mesma estrutura e classes do AuthShell do web, com texto de uso interno.
export default function LoginPage() {
  const { entrar } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await entrar(email, senha);
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="Ludora">
        <Brand />
        <div className="auth-story-content">
          <span className="eyebrow">USO INTERNO · EQUIPE LUDORA</span>
          <h2>Todos os clubes.<br />Uma só<br /><span>visão.</span></h2>
          <p>Gerencie clubes-clientes, permissões e a saúde da plataforma em um só lugar.</p>
        </div>
        <span className="auth-story-footer">ACESSO RESTRITO AOS DESENVOLVEDORES.</span>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <ThemeToggle />
          <div className="auth-mobile-brand"><Brand /></div>
          <div className="auth-heading">
            <span className="eyebrow">PAINEL SUPER ADMIN</span>
            <h1>Entrar no painel</h1>
            <p>Use a conta da equipe cadastrada como Super Admin.</p>
          </div>
          <form onSubmit={enviar} className="auth-form">
            <Input label="E-mail" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="voce@ludora.com" />
            <PasswordInput autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} required placeholder="Digite sua senha" />
            {erro && <div className="auth-erro" role="alert">{erro}</div>}
            <button className="btn btn-primary btn-md auth-btn" disabled={enviando}>{enviando ? 'Entrando...' : 'Entrar'}</button>
          </form>
        </div>
      </section>
    </main>
  );
}
