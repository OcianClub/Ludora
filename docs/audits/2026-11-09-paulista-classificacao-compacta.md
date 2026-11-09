# Classificação Paulista — apresentação compacta

Implementação restrita ao web, sem migração, gravação na API ou alteração das estatísticas.

- Tabela e resumo do clube em colunas quando há largura disponível. O ponto de adaptação usa a largura real do conteúdo, considerando a sidebar aberta ou recolhida.
- Em telas menores o resumo aparece acima da tabela; posição/equipe permanecem visíveis durante a rolagem horizontal das estatísticas.
- Chaves com cores discretas, equipe atual em azul, posição em destaque, campanha V/E/D e informações complementares recolhidas.
- Cada faixa é um `tbody`, com cabeçalho semântico e posições originais preservadas.

## Origem das faixas

As cores não classificam equipes pelo seu lugar na tabela. `chavesDasEquipes` usa as fases dos jogos e tabelas eliminatórias publicadas. Mais de uma chave atribuída à mesma equipe impede uma atribuição inequívoca; Torneio União fica fora.

`faixasPublicadas` só agrupa uma classificação inicial de grupo/chave única, com posições contínuas, chaves contíguas e pelo menos duas chaves publicadas. Não aplica cortes aos grupos independentes da Base A3. Se houver equipes sem chave no final da classificação, identifica apenas que a chave não foi publicada. Não inventa uma Chave Bronze para a Base A1/A2.

## Validação

- 31 testes de utilitários aprovados, incluindo publicações capturadas dos eventos 900, 901, 908, 907 e 925, conflitos de chave, grupos independentes e tabelas parciais.
- Verificação em navegador: 320, 390, 600, 820, 1024, 1280, 1440 e 1920 px, gestor/visitante, sidebar expandida/recolhida; tema claro em 390 e 1440 px. Conferência de ordem oficial, alinhamento de cabeçalhos, destaque da linha inteira, faixas, ausência de overflow da página e troca de grupo sem reaproveitar o resumo do clube errado.
- Regressão das quatro abas em 390 e 1440 px, gestor/visitante.
- Build do web aprovado. Capturas locais em `test-results/paulista-ranking-*.png`.

Os testes de navegador interceptam as requisições; não alteram banco nem publicam na federação. Os testes com snapshots capturados dependem dos arquivos locais do levantamento anterior.
