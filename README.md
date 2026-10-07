# Calendário — 1º Ano A

Calendário de provas, trabalhos e entregas da turma. A turma abre o link e
consulta; só quem tem a senha adiciona, edita ou remove.

**Site:** https://calendariotarefas.github.io/

## Como funciona

```
Navegador da turma  ──GET──▶  Apps Script  ──▶ lê a planilha        (aberto)
Painel de edição    ──POST─▶  Apps Script  ──▶ confere a senha lá
                                          ──▶ escreve na planilha   (protegido)
```

São três peças:

| peça | onde roda | papel |
|---|---|---|
| `index.html` | navegador de quem abre | mostra o calendário e o painel |
| `apps-script.gs` | servidores do Google | guarda a senha e fala com a planilha |
| planilha | Google Drive | onde os dados realmente ficam |

A senha fica **no Apps Script**, não no site. Quem abrir o código-fonte da
página vê apenas o endereço do script — e sem a senha não escreve nada. É a
diferença entre uma senha de verdade e uma senha decorativa: num site estático
puro, qualquer verificação feita no navegador pode ser contornada por quem lê o
código.

A planilha não precisa ser publicada nem compartilhada: o script a acessa em seu
nome. Ela continua privada.

## Editar o calendário

Pela engrenagem discreta no canto direito da barra (ou acrescentando `#admin` ao
final do link). Digite a senha e aparecem os botões de adicionar, editar e
excluir — tanto no painel quanto dentro de cada dia.

A senha fica guardada só enquanto a aba estiver aberta. Fechou, pede de novo.

Dá para editar direto na planilha também, se preferir. As colunas são
`id | data | tipo | materia | titulo | obs`; deixe o `id` em branco apenas se for
mexer por lá (itens sem `data` ou sem `titulo` são ignorados).

Nos tipos, a busca é por pedaço da palavra: "Lição de casa" cai em *entrega*,
"trabalho em grupo" em *trabalho*, "Avaliação" em *prova*. O que não casa com
nada vira *aviso*.

## Instalação

1. Crie uma planilha no Google Drive.
2. Nela: **Extensões → Apps Script**. Apague o `Code.gs` e cole o
   `apps-script.gs` deste repositório.
3. Troque o valor de `SENHA` no topo do arquivo.

   A senha fica **só no editor do Google**, nunca aqui: este repositório é
   público, e uma senha versionada seria uma senha publicada. Se existir um
   `apps-script.local.gs` na sua máquina, é a cópia com a senha já preenchida
   para colar — ela é ignorada pelo git de propósito.
4. **Implantar → Nova implantação → App da Web**, executando como **Eu**, com
   acesso para **Qualquer pessoa**. Autorize quando o Google pedir.
5. Copie a URL que termina em `/exec` e cole em `API_URL`, no `index.html`.

Ao alterar o Apps Script depois, use **Implantar → Gerenciar implantações →
editar → Versão: Nova versão**, senão o site continua usando a versão antiga.

## Detalhes

- Sem dependências e sem build: um arquivo HTML.
- A última leitura boa fica em cache no navegador de cada visitante. A página
  pinta esse cache imediatamente e busca a versão nova por baixo, então o
  calendário aparece na hora para quem já visitou, em vez de esperar os ~2,5s
  do Apps Script. Sem internet, fica o cache com aviso de desatualizado.
- Escritas usam `LockService`, para dois cadastros ao mesmo tempo não se
  sobrescreverem.
- Senha errada leva 1,2s para responder, o que encarece tentar adivinhar.
- Tema claro/escuro/automático, lembrado por aparelho.
- Abrindo o arquivo direto do disco (`file://`), o navegador pode bloquear a
  conversa com o Apps Script. O ambiente válido para teste é o site publicado.

## Testes

Os dois lados têm suíte de teste em `testes/`:

```
node testes/backend.js    # roda o apps-script.gs contra um Sheets falso
node testes/frontend.js   # datas, tipos e normalização da página
```
