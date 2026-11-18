describe('Homologação Ludora', () => {
  describe('Autenticação', () => {
    beforeEach(() => {
      cy.clearLocalStorage();
      cy.intercept('POST','**/auth/login',{statusCode:401,body:{error:'E-mail ou senha inválidos'}}).as('login');
      cy.visit('/login');
    });
    it('CT01 campos obrigatórios impedem o envio', () => {
      cy.get('button[form="login-form"]').click();
      cy.get('[name=email]').should('have.attr','aria-invalid','true');
      cy.screenshot('CT01-campos-obrigatorios');
    });
    it('CT02 e-mail inválido recebe orientação', () => {
      cy.get('[name=email]').type('email-invalido').blur();
      cy.contains('Digite um e-mail válido').should('be.visible');
    });
    it('CT03 credenciais recusadas exibem erro', () => {
      cy.get('[name=email]').type('teste@example.test');
      cy.get('[name=senha]').type('senha1234');
      cy.get('button[form="login-form"]').click();
      cy.wait('@login').its('response.statusCode').should('eq',401);
      cy.contains('E-mail ou senha inválidos').should('be.visible');
      cy.screenshot('CT03-acesso-recusado');
    });
  });
  describe('Preparação da partida', () => {
    beforeEach(() => cy.visit('/login'));
    const dados = () => ({
      podePreparar:true,
      partida:{status:'AGENDADA', data:'2026-11-12', horario:'19:30', titulares_necessarios:5},
      minhaEquipeId:2,
      equipes:[{id:2, pronta:false, escalacao:[]}],
    });
    it('CT04 partida sem escalação começa nos dados', () => {
      cy.window().then(win => win.eval("import('/src/utils/matchPreparation.ts')")).then(m =>
        expect(m.resolvePreparationStep(dados(),null)).to.equal(0));
    });
    it('CT05 escalação incompleta impede avançar para revisão', () => {
      const partida=dados();
      partida.equipes[0].escalacao=[{titular:true,numCamisa:1}];
      cy.window().then(win => win.eval("import('/src/utils/matchPreparation.ts')")).then(m =>
        expect(m.resolvePreparationStep(partida,'2')).to.equal(1));
    });
    it('CT06 camisas repetidas impedem avançar para revisão', () => {
      const partida=dados();
      partida.equipes[0].escalacao=[1,2,3,4,4].map(numCamisa=>({titular:true,numCamisa}));
      cy.window().then(win => win.eval("import('/src/utils/matchPreparation.ts')")).then(m =>
        expect(m.resolvePreparationStep(partida,'2')).to.equal(1));
    });
    it('CT07 escalação válida permite acessar a revisão', () => {
      const partida=dados();
      partida.equipes[0].escalacao=[1,2,3,4,5].map(numCamisa=>({titular:true,numCamisa}));
      cy.window().then(win => win.eval("import('/src/utils/matchPreparation.ts')")).then(m =>
        expect(m.resolvePreparationStep(partida,'2')).to.equal(2));
    });
  });
  describe('Eventos de partida', () => {
    beforeEach(() => cy.visit('/login'));
    const dados = () => ({
      partida:{gols_mandante:1,gols_visitante:1,mandante_id:10,visitante_id:20},
      equipes:[{time_id:10},{time_id:20}],
      eventos:[{id:1,tipo:'GOL',time_id:20},{id:2,tipo:'GOL',time_id:10}],
    });
    it('CT08 placar histórico segue a ordem dos gols', () => {
      cy.window().then(win => win.eval("import('/src/utils/matchEvents.ts')")).then(m => {
        const scores=m.eventScores(dados());
        expect(scores.get(1)).to.equal('0 - 1');
        expect(scores.get(2)).to.equal('1 - 1');
      });
    });
    it('CT09 gol contra pertence ao adversário para autoria', () => {
      cy.window().then(win => win.eval("import('/src/utils/matchEvents.ts')")).then(m =>
        expect(m.eventAuthorTeam(dados(),{tipo:'GOL',time_id:10,gol_contra:true})).to.equal(20));
    });
  });
});