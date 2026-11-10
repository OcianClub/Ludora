import { Component, type ReactNode } from 'react';
import { DesktopState } from './AdminUI';

// Uma falha de renderização de uma página não deve derrubar a navegação.
export class DesktopErrorBoundary extends Component<{ children: ReactNode }, { falhou: boolean; tentativa: number }> {
  state = { falhou: false, tentativa: 0 };
  static getDerivedStateFromError() { return { falhou: true }; }
  render() {
    if (this.state.falhou) return <DesktopState error title="Não foi possível exibir esta tela" description="Tente abrir novamente ou acesse outra seção pela navegação."
      onRetry={() => this.setState(s => ({ falhou: false, tentativa: s.tentativa + 1 }))}/>;
    return <div key={this.state.tentativa} className="desktop-page-boundary">{this.props.children}</div>;
  }
}
