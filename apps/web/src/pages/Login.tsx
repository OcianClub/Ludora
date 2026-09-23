import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Auth.css';
import { AuthShell } from '../components/AuthShell';
import { PasswordInput } from '../components/PasswordInput';
import { Input } from '../components/UI';

export default function LoginPage() {
  const { login, fazendoLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    try {
      await login(email, senha);
      navigate('/selecionar-clube');
    } catch (err: any) {
      setErro(err.message || 'Erro ao fazer login');
    }
  }

  return (
    <AuthShell title="Entre no jogo" subtitle="Acesse sua conta para acompanhar o seu clube.">
        <form onSubmit={handleSubmit} className="auth-form">
          <Input label="E-mail" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" />
          <PasswordInput autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} required placeholder="Digite sua senha" />
          {erro && <div className="auth-erro" role="alert">{erro}</div>}
          <button className="btn btn-primary btn-md auth-btn" disabled={fazendoLogin}>
            {fazendoLogin ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <p className="auth-link">Não tem conta? <Link to="/registrar">Criar conta</Link></p>
    </AuthShell>
  );
}
