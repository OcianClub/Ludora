import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Auth.css';

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
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo">LUDORA</span>
          <p className="auth-sub">Sistema de Gestão Esportiva</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field">
            <label className="field-label">E-mail</label>
            <input className="field-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" />
          </div>
          <div className="field">
            <label className="field-label">Senha</label>
            <input className="field-input" type="password" value={senha} onChange={e => setSenha(e.target.value)} required placeholder="••••••••" />
          </div>
          {erro && <div className="auth-erro">{erro}</div>}
          <button className="btn btn-primary btn-md auth-btn" disabled={fazendoLogin}>
            {fazendoLogin ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <p className="auth-link">Não tem conta? <Link to="/registrar">Criar conta</Link></p>
      </div>
    </div>
  );
}
