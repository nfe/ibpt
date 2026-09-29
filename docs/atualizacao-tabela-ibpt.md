# Atualização da tabela IBPT

## Causa raiz: NFS-e com 15,89% "IBPT (18.1.B)" (issue #2)

Diagnóstico confirmado em produção em 29/09/2026:

- O `dfetech-service-invoice-api` lê de `https://ibpt.nfe.io` (`IbptApi__BaseAddress` em
  `kubernetes/ServiceInvoicesApp/values-production.yaml`). Esse domínio responde pela Cloudflare
  (`cf-cache-status: DYNAMIC`, sem cabeçalhos de Azure ou GCS). O storage
  `nfeprodibpt.blob.core.windows.net`, citado no `.env.example` da API, **não existe mais**.
- A API consulta **somente a tabela LC116**:
  `OneAsync("lc116", uf, federalServiceCode)` em `ServiceInvoiceApplicationService.cs`.
  A tabela NBS não participa do cálculo.
- O que `ibpt.nfe.io` serve hoje é a **21.1.F**, publicada fora deste repositório
  (`Last-Modified` de 14/09/2026). Por exemplo, `nbs/sp/114063300.json` = 21.1.F, 17,51%.
- `ibpt.nfe.io/lc116/sp/1725.json` responde **18.1.B**, `code` vazio, 13,45 + 0 + 2,44 = **15,89%**,
  exatamente o valor da nota.

O item 17.25 da LC 116 ("inserção de propaganda em qualquer meio") e os demais itens criados
pela LC 157/2016 **não existem na tabela do IBPT**. Em 04/04/2018 o commit `2670309`
("Add JSON data for new services version 18.1.B") criou esses arquivos **à mão**, para todos os
estados:

| Código LC116 | Versão | Observação |
|---|---|---|
| `0109` | 18.1.B | |
| `0606` | 18.1.B | `code` vazio |
| `1602` | 18.1.B | `code` vazio |
| `1725` | 18.1.B | `code` vazio |
| `2505` | 18.1.B | `code` vazio |

Como esses códigos não estão no CSV do IBPT, nenhuma regeração posterior tocou nesses arquivos,
e eles seguiam com os dados de 2018.

**Correção:** `lc116-nbs-map.json` associa cada um desses itens a um código NBS, conforme a tabela
de correlação LC116 × NBS (`docs/lc116NbsCorrelationTable-pt-br.json` do `dfetech-service-invoice-api`).
A cada geração, o gerador cria `lc116/{uf}/{codigo}.json` com as alíquotas desse NBS na mesma versão,
com o campo `mappedFrom`. Se o IBPT passar a publicar o item na tabela LC116, a linha oficial prevalece.

| LC116 | NBS | Descrição do NBS |
|---|---|---|
| 06.06 | 1.2602.90.00 | Tratamento de beleza e bem-estar físico n.c.o.p. |
| 16.02 | 1.0401.19.00 | Transporte terrestre local de passageiros n.c.o.p. |
| 17.25 | 1.1406.33.00 | Venda de espaço para propaganda na internet, exceto sob comissão |
| 25.05 | 1.2603.00.00 | Serviços funerários, de cremação e de embalsamamento |
| 01.09 | — | Sem correlação na tabela: o arquivo manual é mantido (inclusive com `--clean`) |

Em 29/09/2026 as tabelas `lc116` e `nbs` foram regeneradas com a **26.2.B**
(vigência 20/09/2026 a 31/10/2026), com `--clean`. Foram removidos 2.808 arquivos NBS de códigos que
não existem mais no IBPT (versões 15.1.B, 15.1.C e 17.1.A). Nenhum arquivo LC116 foi removido.
Os CSVs não foram versionados, porque não havia Git LFS disponível. A tabela `ncm` também foi regenerada com a 26.2.B (`--tables ncm --clean`): 24.030 arquivos de códigos que saíram da NCM foram removidos e 20.574 foram criados.

Também há arquivos NBS que não existem mais na tabela do IBPT (versões 15.1.x e 17.1.A) e
continuam publicados. O `--clean` do gerador evita que isso se repita.

### Por que o repositório parou na 19.2.B

A publicação rodava no Travis CI (`.travis.yml`), em `after_script`, com **Node 0.10**:

1. Em 06/08/2018 o commit `4ca3d1d` ("Update deploy threads") trocou o logger dos
   `deploy_*.js` por `var logger = () => {};`. Arrow functions não existem no Node 0.10,
   então todo script de deploy passou a morrer com `SyntaxError` antes de enviar qualquer arquivo.
2. No Travis, falha em `after_script` **não reprova o build**, e o erro ficou invisível.
3. Em novembro/2019 o commit `5f1583e` atualizou as dependências (`deploy-azure-cdn` 2.x,
   `dotenv` 8, `glob` 7), que também não rodam no Node 0.10.

Outros pontos que agravam o problema:

- Os scripts de deploy só fazem `console.log` do erro e sempre terminam com código 0.
- Os blobs são enviados com `Cache-Control: public, max-age=31556926` (1 ano).
- O gerador só registrava erros de parsing, sem falhar.

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

Os `deploy_lc116.js` / `deploy_nbs.js` publicam no Azure Blob, mas `ibpt.nfe.io` hoje responde
por outra origem, na Cloudflare, e a 21.1.F foi publicada fora deste repositório. Antes de publicar,
identifique essa origem (DNS/Workers/R2 da zona `nfe.io` na Cloudflare) e publique nela.
Depois de publicar, limpe o cache da Cloudflare e confira em `https://ibpt.nfe.io` pelo menos
`nbs/sp/114063300.json` e uma amostra de cada estado, validando o campo `version`.

> **Migração Azure → GCP:** os arquivos são consumidos via `https://ibpt.nfe.io` (Cloudflare) pelo
> `ApproximateTaxesRepository` do `dfetech-service-invoice-api`. Na migração, as tabelas `lc116`,
> `nbs` e `ncm` e os scripts de deploy precisam ir para o novo storage, e a origem de `ibpt.nfe.io`
> na Cloudflare precisa ser apontada para ele. Assim o `IbptApi__BaseAddress` não muda.
