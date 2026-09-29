# Atualização da tabela IBPT

## Causa raiz: produção presa na 18.1.B (issue #2)

Produção (`nfeprodibpt.blob.core.windows.net`) respondia a versão **18.1.B** (abril/2018),
embora o repositório tivesse dados até a **19.2.B** (novembro/2019).

A publicação rodava no Travis CI (`.travis.yml`), em `after_script`, com **Node 0.10**:

1. Em 06/08/2018 o commit `4ca3d1d` ("Update deploy threads") trocou o logger dos
   `deploy_*.js` por `var logger = () => {};`. Arrow functions não existem no Node 0.10,
   então, a partir daí, todo script de deploy morria com `SyntaxError` antes de enviar
   qualquer arquivo.
2. No Travis, falha em `after_script` **não reprova o build**. O erro ficou invisível.
3. Em novembro/2019 o commit `5f1583e` atualizou as dependências (`deploy-azure-cdn` 2.x,
   `dotenv` 8, `glob` 7), que também não rodam no Node 0.10.

Por isso nenhuma versão posterior à 18.1.B (18.2.B, 18.2.C, 19.1.B, 19.2.B) chegou ao blob.
O Travis CI para repositórios abertos foi desligado depois, então hoje não há nenhuma publicação.

Outros pontos que agravam o problema:

- Os scripts de deploy só fazem `console.log` do erro e sempre terminam com código 0.
- Os blobs são enviados com `Cache-Control: public, max-age=31556926` (1 ano).
- O gerador (`generate-json-from-csv.js`) só registrava erros de parsing, sem falhar.

## Gerador

```sh
npm install
# coloque os 27 arquivos TabelaIBPTax{UF}{versão}.csv em raw-data/
node generate-json-from-csv.js 26.2.B --tables lc116,nbs --clean
```

O gerador agora falha (código diferente de 0) quando:

- a versão não é informada ou tem formato inválido;
- falta o CSV de algum dos 27 estados;
- alguma linha tem versão diferente da informada;
- algum estado não gera nenhum código para uma tabela selecionada.

`--clean` remove os JSONs antigos das tabelas selecionadas, para que códigos que a IBPT
excluiu não fiquem para trás.

## Publicação

Ainda é manual (`deploy_lc116.js` / `deploy_nbs.js` com `AZURE_ACCOUNT`/`AZURE_TOKEN`).
Depois de publicar, confira pelo menos `nbs/sp/114063300.json` e uma amostra de cada estado
no blob de produção, validando o campo `version`.

> **Migração Azure → GCP:** este projeto publica diretamente no Azure Blob e é consumido pelo
> `ApproximateTaxesRepository` do `dfetech-service-invoice-api` (`IbptApi.BaseAddress`).
> Na migração, os containers `lc116`, `nbs` e `ncm` e os scripts de deploy precisam ser levados
> para o novo storage, e `IbptApi.BaseAddress` precisa ser atualizado.
