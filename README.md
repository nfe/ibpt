IBPT - De Olho no Imposto
=========================

O Código de Defesa do Consumidor estabelece que você deve incluir em documentos fiscais concedidos aos consumidores o montante total aproximado de governos federal, estaduais e impostos municipais incidentes sobre a venda de bens ou serviços.

O Instituto Brasileiro de Planejamento Tributário (IBPT) fornece um arquivo de texto com a carga fiscal média aproximada de todos os produtos e serviços com base nos códigos das listas:

-	Nomenclatura Comum do Mercosul (NCM)
-	Serviço Nomenclatura Brasileira (NBS)
-	Lei Complementar 116/2003 (LC116)

Como utilizar?
--------------

##### http://ibpt.nfe.io/{tabela}/{estado}/{lc116_nbs_ou_ncm_codigo}.json

**tabela**: *lc116*, *nbs*, *ncm*

**estado**: *Sigla do estado abreviado (SP, RJ, MG, SC, RS...)*

**codigo**: *Código da NCM, NBS, LC116*

### Exemplos

##### http://ibpt.nfe.io/nbs/sp/101011000.json

##### http://ibpt.nfe.io/lc116/sp/0107.json

##### http://ibpt.nfe.io/ncm/sp/90303311.json

IBPT Approximate Taxes
======================

The Consumer Protection Code states that you must include in fiscal documents provided to consumers the approximate total amount of federal, state, and municipal taxes levied on the sale of goods or services.

The Brazilian Institute of Tax Planning (IBPT) provides a text file with the approximate average tax burden of all products and services, based on the list bellow:

-	Mercosur Common Nomenclature (NCM)
-	Brazilian Nomenclature Service (NBS)
-	Complementary Law 116/2003 (LC116)

How to use?
-----------

##### http://ibpt.nfe.io/{table_type}/{state}/{nbs_or_ncm_code}.json

**table_type**: *lc116*, *nbs*, *ncm*

**state**: *Brazilian state abbreviation (SP, RJ, MG, SC, RS...)*

**code**: *NBS, NCM or LC116 code*

### Sample

##### http://ibpt.nfe.io/nbs/sp/101011000.json

##### http://ibpt.nfe.io/lc116/sp/0107.json

##### http://ibpt.nfe.io/ncm/sp/90303311.json
