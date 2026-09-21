import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registrar } from '../services/api';
import './Auth.css';

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
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo">LUDORA</span>
          <p className="auth-sub">Criar conta</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field">
            <label className="field-label">Nome</label>
            <input className="field-input" value={nome} onChange={e => setNome(e.target.value)} required placeholder="Seu nome" />
          </div>
          <div className="field">
            <label className="field-label">E-mail</label>
            <input className="field-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" />
          </div>
          <div className="field">
            <label className="field-label">Senha</label>
            <input className="field-input" type="password" value={senha} onChange={e => setSenha(e.target.value)} required placeholder="••••••••" />
          </div>
          {erro && <div className="auth-erro">{erro}</div>}
          <button className="btn btn-primary btn-md auth-btn" disabled={loading}>
            {loading ? 'Criando...' : 'Criar conta'}
          </button>
        </form>
        <p className="auth-link">Já tem conta? <Link to="/login">Entrar</Link></p>
      </div>
    </div>
  );
}
