exports.install = async (page, { players, lineup, match = () => ({}), confirm = () => {} }) => {
  await page.route('**/partidas/106/gestao', async route => {
    const p = { id: 106, status: 'AGENDADA', versao: 1, titulares_necessarios: 5, periodo_atual: 1, organizador_id: 2, sumula_clube_id: 2, data: '2026-10-29', horario: '19:30', local: 'Ginásio Ocian', categoria_id: 1, categoria: { id: 1, nome: 'sub-7' }, mandante_id: 13, visitante_id: 14, emCasa: true, gols_mandante: 0, gols_visitante: 0, mandante: { id: 13, nome: 'Ocian' }, visitante: { id: 14, nome: 'Aurora' }, ...match() };
    const rows = lineup().map(j => ({ ...j, jogador: players.find(p => p.id === j.jogador_id) }));
    await route.fulfill({ json: { partida: p, organizador: { id: 2, nome: 'Ocian' }, minhaEquipeId: 1, podePreparar: true, podeSumula: true, eventos: [], auditoria: [], equipes: [{ id: 1, clube_id: 2, time_id: 13, categoria_id: 1, categoria: p.categoria, clube: { id: 2, nome: 'Ocian' }, pronta: p.status !== 'AGENDADA', publicada_em: p.status === 'AGENDADA' ? null : '2026-10-29', escalacao: rows }] } });
  });
  await page.route('**/partidas/106/preparacao', route => { confirm(); return route.fulfill({ json: {} }); });
};
