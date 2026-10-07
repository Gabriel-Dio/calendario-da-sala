# Calendário — 1º Ano A

Calendário de provas, trabalhos e entregas da turma. Página única, estática,
somente leitura: quem abre o link só consulta.

**Site:** _(preencher com o link do GitHub Pages)_

## Como adicionar uma prova

Tudo vive na planilha do Google — o site só a lê. Não é preciso mexer no código
nem republicar nada: edite a planilha e o site mostra na próxima vez que alguém
abrir (ou ao clicar no ⟳).

Colunas da planilha (a ordem não importa; acentos e maiúsculas no cabeçalho são
ignorados):

| coluna    | obrigatória | exemplo                        |
|-----------|-------------|--------------------------------|
| `data`    | sim         | `14/10/2026` ou `2026-10-14`   |
| `tipo`    | não         | `prova`, `trabalho`, `entrega`, `aviso` |
| `materia` | não         | `Física`                       |
| `titulo`  | sim         | `P2 — Cinemática`              |
| `obs`     | não         | `Capítulos 3 e 4`              |

Linhas sem `data` ou sem `titulo` são ignoradas, e a página avisa quantas foram.

No `tipo`, a busca é por pedaço da palavra: "Lição de casa" cai em *entrega*,
"trabalho em grupo" em *trabalho*, "Avaliação" em *prova*. O que não casa com
nada vira *aviso*.

## Configuração

O único ajuste fica em `index.html`:

```js
const CSV_URL = '';   // link CSV publicado da planilha
```

Para gerar esse link: na planilha, **Arquivo → Compartilhar → Publicar na web →
escolher a aba → "Valores separados por vírgula (.csv)" → Publicar**.

Isso publica apenas o conteúdo daquela aba como CSV. A planilha continua privada
para edição.

## Detalhes

- Sem dependências, sem build: um arquivo HTML.
- A última leitura boa da planilha fica em cache no navegador de cada visitante,
  então o calendário abre mesmo sem internet ou com o Google fora do ar — nesse
  caso com um aviso de que está desatualizado.
- Tema claro/escuro/automático, lembrado por aparelho.
- Abrindo o arquivo direto do disco (`file://`), o navegador pode bloquear a
  leitura da planilha. O ambiente válido para teste é o site publicado ou um
  servidor local.
