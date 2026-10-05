# Oportunidades do Google (quick wins)

## Objetivo
Encontrar buscas em que o site do cliente já aparece entre as posições 4 e 20 do Google e priorizá-las
por demanda real (Keyword Planner), para virar pauta ou orientar a otimização da página que já ranqueia.

## Entradas
- Vínculo do cliente com o Search Console (`client_google`): propriedade e conta (`contato` | `ryan`).
- Credenciais no Worker da API: `GOOGLE_ADS_*` (conta contato — também é a do Keyword Planner) e `GOOGLE_DATA_*` (conta ryan).
- MCC do Keyword Planner: `GOOGLE_ADS_LOGIN_CUSTOMER_ID` = 3780611396.

## Execução
1. `execution/src/opportunities/sync.ts` → `calcularQuickWins`: Search Console, 28 dias terminando 3 dias atrás, em DUAS chamadas: dimensão `query` (fonte de cliques, impressões, CTR e posição) e `query` × `page` (só para escolher a página com mais impressões por busca). Somar as linhas busca × página distorceria impressões e posição.
2. `quickWins.ts` (`aggregateQueries`): agrega variações da mesma busca (acento/caixa) com posição ponderada por impressões, tira buscas de marca (`marcaTermos`; compara texto compacto, sem acento nem espaços, por "contém"), mantém posição 4–20 com ≥ 20 impressões, até 100.
3. `keywordPlanner.ts`: volume mensal no Brasil, em português. Palavras com mais de 80 caracteres, mais de 10 palavras ou símbolos fora de letras, dígitos, espaço e `- ' . & +` são puladas (`keywordAceitaPeloAds`) porque o Ads recusaria o lote inteiro; ficam sem volume. Falhou? Salva sem volume e mostra o aviso — não bloqueia.
4. Score 0–100 = 40% demanda (volume mensal; sem volume, as impressões dos 28 dias) + 35% ganho de cliques até o CTR da posição 3 (10%) + 25% proximidade do top 3.
5. `store.ts`: upsert por (cliente, tipo, busca normalizada). Nova sincronização nunca muda o status; a limpeza apaga só as `nova` que esta sincronização não atualizou (`updated_at` anterior ao horário do lote); `descartada` e `em_pauta` ficam. "Virar pauta" cria a pauta e muda o status na mesma transação (`criarPautaDaOportunidade`).

## Saídas
- Tabela `opportunities`; aba **Google** do cliente; botão "Virar pauta" cria `article_ideas` com justificativa e a página que já ranqueia em `artigos_relacionados`.
- Pauteiro recebe as 20 melhores oportunidades `nova` como `demanda_google`.

## Edge cases
- 403 `SERVICE_DISABLED`: ativar a Search Console API no projeto do client OAuth.
- 429 com cota 0: projeto do Google Cloud sem aprovação para a API.
- `invalid_grant`: refresh token revogado — gerar outro com o mesmo client e os mesmos escopos.
- Keyword Planner `CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION`: developer token só com acesso de teste naquele projeto. As credenciais `GOOGLE_ADS_*` (projeto 253030348436) têm acesso de produção.
- Busca de marca com nome muito curto (< 4 letras) não é filtrada: descartar na UI.

## Aprendizados
- (registrar aqui o que mudar ao rodar com clientes reais)
