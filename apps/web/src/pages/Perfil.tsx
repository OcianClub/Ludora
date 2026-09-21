import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Btn, Card, Input, PapelBadge } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { fetchMeuPerfil, PerfilUsuario } from '../services/api';
import './Perfil.css';

export default function PerfilPage() {
  const { usuario, clube, atualizarPerfil, definirClube } = useAuth();
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [nome, setNome] = useState(usuario?.nome || '');
  const [email, setEmail] = useState(usuario?.email || '');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fetchMeuPerfil()
      .then(dados => {
        setPerfil(dados);
        setNome(dados.nome);
        setEmail(dados.email);
      })
      .catch(err => setErro(err.message));
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setConfirmacao('');
    if (senha && senha.length < 8) {
      setErro('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }

    setSalvando(true);
    try {
      await atualizarPerfil({ nome, email, senha: senha || undefined });
      setSenha('');
      setConfirmacao('Perfil atualizado com sucesso.');
      setPerfil(await fetchMeuPerfil());
    } catch (err: any) {
      setErro(err.message || 'Não foi possível atualizar o perfil');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="perfil-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Meu perfil</h1>
          <p className="page-sub">Consulte seus dados e os clubes que você acompanha.</p>
        </div>
      </div>

      <div className="perfil-grid">
        <Card>
          <div className="perfil-identidade">
            <div className="perfil-avatar">{usuario?.nome?.[0]?.toUpperCase() || '?'}</div>
            <div>
              <h2>{usuario?.nome || 'Usuário'}</h2>
              <p>{usuario?.email}</p>
              {perfil?.criadoEm && (
                <span>Membro desde {new Date(perfil.criadoEm).toLocaleDateString('pt-BR')}</span>
              )}
            </div>
          </div>

          <form className="perfil-form" onSubmit={salvar}>
            <Input label="Nome" value={nome} onChange={e => setNome(e.target.value)} required minLength={2} maxLength={100} />
            <Input label="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            <Input label="Nova senha (opcional)" type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo de 8 caracteres" />
            {erro && <div className="perfil-alerta perfil-alerta--erro">{erro}</div>}
            {confirmacao && <div className="perfil-alerta perfil-alerta--sucesso">{confirmacao}</div>}
            <Btn type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar alterações'}</Btn>
          </form>
        </Card>

        <Card>
          <div className="perfil-clubes-header">
            <div>
              <h2>Clubes acompanhados</h2>
              <p>Seu papel no web é de torcedor. Perfis de gestão são criados no desktop.</p>
            </div>
            <Btn variant="ghost" size="sm" onClick={() => navigate('/selecionar-clube')}>Encontrar clubes</Btn>
          </div>

          <div className="perfil-clubes">
            {perfil?.clubes.map(item => (
              <button
                type="button"
                key={item.id}
                className={`perfil-clube${clube?.id === item.id ? ' ativo' : ''}`}
                onClick={() => {
                  definirClube(item);
                  navigate('/dashboard');
                }}
              >
                <span className="perfil-clube-escudo">
                  {item.escudo ? <img src={item.escudo} alt="" /> : item.nome[0]}
                </span>
                <span className="perfil-clube-info">
                  <strong>{item.nome}</strong>
                  <small>{[item.cidade, item.estado].filter(Boolean).join(', ') || 'Local não informado'}</small>
                </span>
                <PapelBadge papel={item.meuPapel || 'TORCEDOR'} />
              </button>
            ))}
            {perfil && perfil.clubes.length === 0 && (
              <div className="perfil-sem-clube">
                Você ainda não acompanha nenhum clube.
                <Btn size="sm" onClick={() => navigate('/selecionar-clube')}>Encontrar clube</Btn>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
