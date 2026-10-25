import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Btn, Card, Input, PapelBadge } from '../components/UI';
import { Icon } from '../components/Icon';
import { ThemeToggle } from '../components/ThemeToggle';
import { LogoutButton } from '../components/LogoutButton';
import { useAuth } from '../contexts/AuthContext';
import { atualizarPreferenciaNotificacoes, fetchMeuPerfil, PerfilUsuario } from '../services/api';
import { getThemePreference, setThemePreference } from '../styles/theme';
import './Perfil.css';

const SECOES = [
  { id: 'dados', label: 'Dados pessoais', icon: 'user' },
  { id: 'preferencias', label: 'Preferências', icon: 'settings' },
  { id: 'clubes', label: 'Meus clubes', icon: 'shield' },
  { id: 'conta', label: 'Conta', icon: 'logout' },
] as const;

export default function PerfilPage() {
  const { usuario, clube, atualizarPerfil, definirClube } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const secao = SECOES.find(item => item.id === searchParams.get('secao'))?.id || 'dados';
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [nome, setNome] = useState(usuario?.nome || '');
  const [email, setEmail] = useState(usuario?.email || '');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [salvandoNotificacoes, setSalvandoNotificacoes] = useState(false);
  const [erroPreferencias, setErroPreferencias] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const [avisoPreferencias, setAvisoPreferencias] = useState('');
  const [temaSistema, setTemaSistema] = useState(() => getThemePreference() === 'system');
  const dadosAlterados = !!perfil && (nome !== perfil.nome || email !== perfil.email || senha.length > 0);

  useEffect(() => {
    const sync = () => setTemaSistema(getThemePreference() === 'system');
    window.addEventListener('ludora:theme-change', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('ludora:theme-change', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setCarregando(true);
    setErroCarregamento('');
    fetchMeuPerfil(controller.signal)
      .then(dados => {
        if (controller.signal.aborted) return;
        setPerfil(dados);
        setNome(dados.nome);
        setEmail(dados.email);
      })
      .catch(() => {
        if (!controller.signal.aborted) setErroCarregamento('Não foi possível carregar sua conta. Verifique a conexão e tente novamente.');
      })
      .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
    return () => controller.abort();
  }, [tentativa]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!dadosAlterados || salvando) return;
    setErro('');
    setConfirmacao('');
    if (senha && senha.length < 8) {
      setErro('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }

    setSalvando(true);
    try {
      const nomeAtualizado = nome.trim();
      const emailAtualizado = email.trim().toLowerCase();
      await atualizarPerfil({ nome: nomeAtualizado, email: emailAtualizado, senha: senha || undefined });
      setNome(nomeAtualizado);
      setEmail(emailAtualizado);
      setSenha('');
      setConfirmacao('Perfil atualizado com sucesso.');
      setPerfil(atual => atual ? { ...atual, nome: nomeAtualizado, email: emailAtualizado } : atual);
    } catch (err: any) {
      setErro(err.message || 'Não foi possível atualizar o perfil');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarNotificacoes() {
    if (!perfil || salvandoNotificacoes || salvando) return;
    setSalvandoNotificacoes(true);
    setErroPreferencias('');
    setAvisoPreferencias('');
    try {
      const resposta = await atualizarPreferenciaNotificacoes(!(perfil.notificacoes_ativas ?? true));
      setPerfil(atual => atual ? { ...atual, notificacoes_ativas: resposta.ativa } : atual);
      setAvisoPreferencias(resposta.ativa ? 'Notificações ativadas.' : 'Notificações desativadas. O histórico continua disponível no sino.');
    } catch (err: any) {
      setErroPreferencias(err.message || 'Não foi possível atualizar as notificações.');
    } finally {
      setSalvandoNotificacoes(false);
    }
  }

  return (
    <div className="perfil-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Meu perfil</h1>
          <p className="page-sub">Sua conta, do seu jeito.</p>
        </div>
        {clube && <Link className="btn btn-ghost btn-md" to="/dashboard"><Icon name="chevronLeft" size={18} />Voltar ao clube</Link>}
      </div>

      <div className="perfil-settings-layout">
      <nav className="perfil-atalhos" role="tablist" aria-label="Seções da conta">
        {SECOES.map((item, index) => (
          <button key={item.id} id={`perfil-tab-${item.id}`} type="button" role="tab"
            aria-selected={secao === item.id} aria-controls={`perfil-panel-${item.id}`}
            tabIndex={secao === item.id ? 0 : -1}
            onClick={() => setSearchParams(item.id === 'dados' ? {} : { secao: item.id })}
            onKeyDown={event => {
              let next = index;
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % SECOES.length;
              else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + SECOES.length - 1) % SECOES.length;
              else if (event.key === 'Home') next = 0;
              else if (event.key === 'End') next = SECOES.length - 1;
              else return;
              event.preventDefault();
              const selected = SECOES[next];
              setSearchParams(selected.id === 'dados' ? {} : { secao: selected.id });
              document.getElementById(`perfil-tab-${selected.id}`)?.focus();
            }}>
            <Icon name={item.icon} size={20} />{item.label}
          </button>
        ))}
      </nav>
      <div className="perfil-settings-content">
      {erroCarregamento && (
        <div className="notice-error" role="alert">
          <p>{erroCarregamento}</p>
          <Btn variant="ghost" size="sm" onClick={() => setTentativa(atual => atual + 1)}>Tentar novamente</Btn>
        </div>
      )}

      <section id="perfil-panel-dados" role="tabpanel" aria-labelledby="perfil-tab-dados" hidden={secao !== 'dados'} tabIndex={0}>
        <Card className="perfil-dados-card">
          <h2 className="perfil-section-title" id="perfil-dados" tabIndex={-1}>Dados pessoais</h2>
          <p className="perfil-section-description">Mantenha seu nome e seus dados de acesso atualizados.</p>
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
            <Input label="Nome" value={nome} onChange={e => setNome(e.target.value)} required minLength={2} maxLength={100} autoComplete="name" disabled={carregando || salvando} />
            <Input label="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" disabled={carregando || salvando} />
            <Input label="Nova senha (opcional)" type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo de 8 caracteres" autoComplete="new-password" disabled={carregando || salvando} />
            <p className="perfil-form-hint">Deixe a senha em branco para manter a atual.</p>
            {erro && <div className="perfil-alerta perfil-alerta--erro" role="alert">{erro}</div>}
            {confirmacao && <div className="perfil-alerta perfil-alerta--sucesso" role="status">{confirmacao}</div>}
            <Btn type="submit" disabled={salvando || salvandoNotificacoes || carregando || !dadosAlterados}>{salvando ? 'Salvando...' : 'Salvar alterações'}</Btn>
          </form>
        </Card>
      </section>
      <section id="perfil-panel-clubes" role="tabpanel" aria-labelledby="perfil-tab-clubes" hidden={secao !== 'clubes'} tabIndex={0}>
        <Card className="perfil-clubes-card">
          <div className="perfil-clubes-header">
            <div>
              <h2 id="perfil-clubes" tabIndex={-1}>Meus clubes</h2>
              <p>Consulte seus vínculos e alterne entre os clubes disponíveis.</p>
            </div>
          </div>

          <div className="perfil-clubes">
            {carregando && <p role="status">Carregando seus clubes…</p>}
            {[...(perfil?.clubes || [])].sort((a, b) => Number(b.id === clube?.id) - Number(a.id === clube?.id)).map(item => (
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
                  <small>{clube?.id === item.id ? 'Clube atual' : [item.cidade, item.estado].filter(Boolean).join(', ') || 'Acessar clube'}</small>
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
          <Link to="/selecionar-clube" className="perfil-explorar">Explorar clubes<Icon name="chevronRight" size={18} /></Link>
        </Card>
      </section>
      <section id="perfil-panel-preferencias" role="tabpanel" aria-labelledby="perfil-tab-preferencias" hidden={secao !== 'preferencias'} tabIndex={0}>
      <Card className="perfil-preferencias-card">
        <div className="perfil-preferencias-header">
          <div>
            <h2 id="perfil-preferencias" tabIndex={-1}>Preferências</h2>
            <p>Ajuste a aparência e os avisos que você recebe.</p>
          </div>
        </div>

        <div className="perfil-preferencias-lista">
          <div className="perfil-preferencia">
            <div>
              <strong>Aparência</strong>
              <span>Alterne entre os temas claro e escuro.</span>
            </div>
            <ThemeToggle />
              <button type="button" aria-pressed={temaSistema} className="perfil-tema-sistema" onClick={() => {
                try {
                  setThemePreference('system');
                  setErroPreferencias('');
                } catch {
                  setErroPreferencias('Não foi possível salvar a aparência. Tente novamente.');
                }
              }}>{temaSistema ? 'Seguindo o dispositivo' : 'Usar tema do dispositivo'}</button>
          </div>

          <div className="perfil-preferencia">
            <div>
              <strong>Notificações</strong>
              <span>Notificações no aplicativo sobre partidas, gols e resultados. O histórico no sino permanece disponível.</span>
            </div>
            <button
              type="button"
              className="perfil-switch settings-switch"
              role="switch"
              aria-label="Receber notificações"
              aria-checked={perfil?.notificacoes_ativas ?? true}
              disabled={!perfil || carregando || salvando || salvandoNotificacoes}
              onClick={alternarNotificacoes}
            >
              <span className="settings-switch-thumb" aria-hidden="true" />
            </button>
          </div>
        </div>

        {erroPreferencias && <div className="perfil-alerta perfil-alerta--erro" role="alert">{erroPreferencias}</div>}
        <p className="perfil-preferencias-status" role="status">{salvandoNotificacoes ? 'Salvando preferência…' : avisoPreferencias}</p>

      </Card>
      </section>
      <section id="perfil-panel-conta" role="tabpanel" aria-labelledby="perfil-tab-conta" hidden={secao !== 'conta'} tabIndex={0}>
      <Card>
        <h2 className="perfil-section-title">Conta</h2>
        <p className="perfil-section-description">Gerencie seu acesso ao Ludora neste dispositivo.</p>
        <div className="perfil-sessao">
          <div>
            <Icon name="logout" size={20} />
            <span><strong>Sair da conta</strong><small>Encerra sua sessão neste dispositivo.</small></span>
          </div>
          <LogoutButton />
        </div>
      </Card>
      </section>
      </div>
      </div>
    </div>
  );
}
