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
| 11.05 | 1.1802.30.00 | Serviços de sistemas de segurança |
| 01.09 | — | Sem correlação na tabela: o arquivo manual é mantido (inclusive com `--clean`) |
| 99.01, 99.99 | — | Códigos genéricos (não são itens da LC 116), manuais |

Os códigos 11.05 (GO e SP) e 99.01/99.99 (GO e RJ) foram criados à mão no storage entre
outubro/2025 e junho/2026, fora deste repositório, provavelmente para destravar notas que falhavam
com `ibpt code 'X' was not found`. O 11.05 agora é gerado pelo NBS para todos os estados. Os
arquivos de GO dos códigos 99.xx foram versionados. Os de RJ existem só no bucket e ficam protegidos,
porque o `publish-r2.js` nunca apaga códigos manuais (`nbs: null` no mapa).

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

`https://ibpt.nfe.io` é o custom domain do bucket R2 **`ibpt`** da conta Cloudflare NFE.io,
migrado do Azure em 14 e 15/09/2026. Os objetos ficam comprimidos (`Content-Encoding: gzip`,
`Content-Type: application/json`). Nenhuma cache rule da zona se aplica a esse domínio
(`cf-cache-status: DYNAMIC`), então não é preciso fazer purge depois de publicar.

O bucket também tem o prefixo `data/`, com dados públicos que não vêm deste repositório
(cidades, estados, CFOP, países). **A publicação nunca pode tocar nesse prefixo.**

### GitHub Action

A publicação é feita pelo workflow `.github/workflows/publish.yml` (**Publish IBPT tables**):

- **push na `master`** que altere `lc116/`, `nbs/`, `ncm/`, `lc116-nbs-map.json` ou o script:
  publica (`--apply`) só o que mudou;
- **pull request** para a `master`: roda a simulação e mostra no resumo do job o que seria enviado
  e apagado;
- **execução manual** (Actions → Publish IBPT tables → Run workflow): simulação por padrão, com as
  opções `apply` e `allow_mass_delete`. Use a segunda quando uma versão nova do IBPT remover mais
  de 25% dos códigos de uma tabela: o push falha na trava, e a execução manual libera.

Duas publicações nunca rodam ao mesmo tempo, e uma simulação nunca substitui uma publicação na fila.

O token de escrita **nunca fica disponível para código que não passou por merge**. Um PR, mesmo de
uma branch deste repositório, executa o próprio `package.json`, o script e o workflow do PR. Por
isso as credenciais são separadas:

| Onde | Secret | Token do R2 | Usado por |
|---|---|---|---|
| Repositório | `R2_ACCOUNT_ID` | ID da conta (`aec519e6630258afd5c061edb8eccb7e`) | os dois jobs |
| Repositório | `R2_READONLY_ACCESS_KEY_ID`, `R2_READONLY_SECRET_ACCESS_KEY` | **Object Read only**, bucket `ibpt` | simulações (PR e manual) |
| Environment `production` | `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | **Object Read & Write**, bucket `ibpt` | publicação (push na `master` e manual com `apply`) |

O environment `production` precisa estar configurado com **Deployment branches and tags: Selected
branches → `master`**. Assim, só jobs rodando na `master` leem o token de escrita, mesmo que um PR
altere o workflow. **Não deixe `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` como secrets do
repositório.**

Sem os secrets de leitura, a simulação do PR é pulada com um aviso. Sem os de escrita, o push falha.

Fluxo de uma versão nova: gerar os JSONs com o gerador, abrir PR (a simulação mostra o impacto no
bucket), revisar e fazer o merge (o Action publica).

### Publicação manual

O `publish-r2.js` também pode ser rodado localmente, com um token de API do R2 com escrita no
bucket `ibpt`:

```sh
export R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=...   # ou .env

node publish-r2.js --tables lc116,nbs,ncm           # simulação: só mostra o que faria
node publish-r2.js --tables lc116,nbs,ncm --apply   # publica
```

- Envia apenas os arquivos cujo conteúdo mudou, comparando o md5 do gzip com o ETag do objeto.
  O gzip é gerado igual em qualquer sistema operacional (byte de SO do cabeçalho fixado em 255).
  A primeira execução depois dessa mudança reenvia tudo uma vez, porque a publicação de 29/09/2026
  foi feita do Windows com outro byte de SO.
- Apaga do bucket os arquivos `{tabela}/{uf}/{codigo}.json` que não existem mais localmente.
  Use `--no-delete` para manter esses arquivos.
- Só lista e altera as chaves dos prefixos das tabelas escolhidas. `data/` e qualquer outro
  prefixo ficam intocados.
- Aborta se uma tabela não tiver arquivos locais, ou se for apagar mais de 25% dos arquivos
  remotos de uma tabela (a menos que se passe `--allow-mass-delete`).
- Termina com código diferente de 0 se algum envio ou deleção falhar.

Depois de publicar, confira em `https://ibpt.nfe.io` pelo menos `lc116/sp/1725.json` e
`nbs/sp/114063300.json` (versão `26.2.B`, 13,45 + 0 + 4,06), validando o campo `version`.

Os `deploy_*.js` publicavam no Azure Blob, que não é mais usado.

> **Consumidor:** o `ApproximateTaxesRepository` do `dfetech-service-invoice-api` lê de
> `https://ibpt.nfe.io` (`IbptApi__BaseAddress`).
