/**
 * Backend do Calendário do 1º Ano A.
 *
 * Este arquivo NÃO vai para o site: ele roda nos servidores do
 * Google, ligado à planilha. É por isso que a senha pode ficar
 * aqui — ninguém que abra o código do site consegue vê-la.
 *
 * COMO INSTALAR
 *  1. Na planilha: Extensões > Apps Script.
 *  2. Apague o conteúdo do Code.gs e cole este arquivo inteiro.
 *  3. Troque o valor de SENHA abaixo pela senha que você quiser.
 *  4. Salve (disquete) e clique em "Implantar" > "Nova implantação".
 *  5. Tipo: "App da Web". Executar como: "Eu". Quem tem acesso:
 *     "Qualquer pessoa". Clique em Implantar e autorize o acesso
 *     (vai aparecer um aviso do Google; é o seu próprio script
 *     pedindo permissão para mexer na sua planilha).
 *  6. Copie a "URL do app da Web" (termina em /exec) e me mande,
 *     ou cole em API_URL no index.html.
 *
 * IMPORTANTE: cada vez que você alterar este script, precisa
 * fazer "Implantar > Gerenciar implantações > editar > Versão:
 * Nova versão", senão o site continua usando a versão antiga.
 */

/* ======================= CONFIGURAÇÃO ======================= */

/** Troque por uma senha sua. Evite algo óbvio como "1234". */
const SENHA = 'troque-esta-senha';

/** Nome da aba usada na planilha. É criada sozinha se não existir. */
const ABA = 'Calendario';

/* ============================================================ */

const COLUNAS = ['id', 'data', 'tipo', 'materia', 'titulo', 'obs'];

/** Leitura: aberta, é o que a turma usa. */
function doGet() {
  try {
    return json({ ok: true, eventos: lerTudo() });
  } catch (err) {
    return json({ ok: false, erro: String(err) });
  }
}

/** Escrita: exige a senha, conferida aqui no servidor. */
function doPost(e) {
  var corpo;
  try {
    corpo = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, erro: 'corpo da requisição inválido' });
  }

  if (String(corpo.senha || '') !== SENHA) {
    // Atraso proposital: encarece tentar adivinhar a senha.
    Utilities.sleep(1200);
    return json({ ok: false, erro: 'senha incorreta' });
  }

  if (corpo.acao === 'verificar') return json({ ok: true });

  // Uma escrita por vez, para dois cadastros simultâneos não se
  // sobrescreverem.
  var trava = LockService.getScriptLock();
  if (!trava.tryLock(20000)) {
    return json({ ok: false, erro: 'a planilha está ocupada, tente de novo' });
  }

  try {
    switch (corpo.acao) {
      case 'adicionar':
        adicionar(corpo.evento);
        break;
      case 'editar':
        if (!editar(corpo.evento)) return json({ ok: false, erro: 'item não encontrado' });
        break;
      case 'remover':
        if (!remover(corpo.id)) return json({ ok: false, erro: 'item não encontrado' });
        break;
      default:
        return json({ ok: false, erro: 'ação desconhecida' });
    }
    return json({ ok: true, eventos: lerTudo() });
  } catch (err) {
    return json({ ok: false, erro: String(err) });
  } finally {
    trava.releaseLock();
  }
}

/* ---------------------- planilha ---------------------- */

function aba() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(ABA);
  if (!sh) sh = ss.insertSheet(ABA);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, COLUNAS.length).setValues([COLUNAS]);
    sh.setFrozenRows(1);
    // Datas como texto, para o Sheets não reinterpretar o formato.
    sh.getRange(2, 2, sh.getMaxRows() - 1, 1).setNumberFormat('@');
  }
  return sh;
}

function lerTudo() {
  var sh = aba();
  var n = sh.getLastRow();
  if (n < 2) return [];

  var valores = sh.getRange(2, 1, n - 1, COLUNAS.length).getValues();
  var lista = [];

  for (var i = 0; i < valores.length; i++) {
    var r = valores[i];
    var data = normalizarData(r[1]);
    var titulo = String(r[4] || '').trim();
    if (!data || !titulo) continue;           // linha incompleta: ignora

    lista.push({
      id: String(r[0] || ''),
      data: data,
      tipo: String(r[2] || '').trim(),
      materia: String(r[3] || '').trim(),
      titulo: titulo,
      obs: String(r[5] || '').trim()
    });
  }
  return lista;
}

function adicionar(ev) {
  var sh = aba();
  var id = 'e' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);
  sh.appendRow([
    id,
    normalizarData(ev && ev.data),
    limpar(ev && ev.tipo),
    limpar(ev && ev.materia),
    limpar(ev && ev.titulo),
    limpar(ev && ev.obs)
  ]);
  return id;
}

function editar(ev) {
  var linha = acharLinha(ev && ev.id);
  if (linha < 0) return false;
  aba().getRange(linha, 2, 1, 5).setValues([[
    normalizarData(ev.data),
    limpar(ev.tipo),
    limpar(ev.materia),
    limpar(ev.titulo),
    limpar(ev.obs)
  ]]);
  return true;
}

function remover(id) {
  var linha = acharLinha(id);
  if (linha < 0) return false;
  aba().deleteRow(linha);
  return true;
}

function acharLinha(id) {
  if (!id) return -1;
  var sh = aba();
  var n = sh.getLastRow();
  if (n < 2) return -1;

  var ids = sh.getRange(2, 1, n - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;   // +2: cabeçalho e base 1
  }
  return -1;
}

/* ---------------------- auxiliares ---------------------- */

/** Aceita Date (o Sheets converte sozinho) ou texto em vários formatos. */
function normalizarData(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var s = String(v || '').trim();
  if (!s) return '';

  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);                 // 2026-10-14
  if (m) return m[1] + '-' + pad(m[2]) + '-' + pad(m[3]);

  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);      // 14/10/2026
  if (m) {
    var a = Number(m[3]);
    if (a < 100) a += 2000;
    return a + '-' + pad(m[2]) + '-' + pad(m[1]);
  }
  return '';
}

function pad(n) { return String(n).length < 2 ? '0' + n : String(n); }
function limpar(v) { return String(v == null ? '' : v).trim().slice(0, 500); }

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
