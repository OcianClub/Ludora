import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registrar } from '../services/api';
import './Auth.css';
import { AuthShell } from '../components/AuthShell';
import { PasswordInput } from '../components/PasswordInput';
import { Input } from '../components/UI';

export default function RegistrarPage() {
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      await registrar(nome, email, senha);
      navigate('/login');
    } catch (err: any) {
      setErro(err.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Crie sua conta" subtitle="Dê o primeiro passo para ficar perto do seu time.">
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-info">
            Crie sua conta e siga clubes como <strong>torcedor</strong>.
            O acesso à gestão depende do seu vínculo com cada clube.
          </div>
          <Input label="Nome completo" autoComplete="name" value={nome} onChange={e => setNome(e.target.value)} required placeholder="Seu nome completo" />
          <Input label="E-mail" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" />
          <PasswordInput autoComplete="new-password" value={senha} onChange={e => setSenha(e.target.value)} required placeholder="Crie uma senha" />
          {erro && <div className="auth-erro" role="alert">{erro}</div>}
          <button className="btn btn-primary btn-md auth-btn" disabled={loading}>
            {loading ? 'Criando...' : 'Criar conta'}
          </button>
        </form>
        <p className="auth-link">Já tem conta? <Link to="/login">Entrar</Link></p>
    </AuthShell>
  );
}
