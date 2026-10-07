/* Roda apps-script.gs contra um Google Sheets falso, para validar
   adicionar / editar / remover antes de implantar de verdade. */
const fs = require('fs');
const codigo = fs.readFileSync(require('path').join(__dirname, '..', 'apps-script.gs'), 'utf8');

/* ---------- planilha falsa ---------- */
function criarPlanilha() {
  const abas = {};

  function novaAba(nome) {
    const dados = [];
    const sh = {
      nome,
      dados,
      getLastRow: () => dados.length,
      getMaxRows: () => Math.max(1000, dados.length),
      setFrozenRows: () => {},
      appendRow: r => dados.push(r.slice()),
      deleteRow: linha => dados.splice(linha - 1, 1),
      getRange: (row, col, nRows, nCols) => ({
        getValues() {
          const out = [];
          for (let i = 0; i < nRows; i++) {
            const linha = dados[row - 1 + i] || [];
            const r = [];
            for (let j = 0; j < nCols; j++) r.push(linha[col - 1 + j] === undefined ? '' : linha[col - 1 + j]);
            out.push(r);
          }
          return out;
        },
        setValues(vals) {
          vals.forEach((linha, i) => {
            const alvo = row - 1 + i;
            while (dados.length <= alvo) dados.push([]);
            linha.forEach((v, j) => { dados[alvo][col - 1 + j] = v; });
          });
        },
        setNumberFormat: () => {}
      })
    };
    abas[nome] = sh;
    return sh;
  }

  return {
    getSheetByName: n => abas[n] || null,
    insertSheet: n => novaAba(n),
    _abas: abas
  };
}

let planilha = criarPlanilha();

const stubs = {
  SpreadsheetApp: { getActive: () => planilha, flush: () => {} },
  ContentService: {
    MimeType: { JSON: 'json' },
    createTextOutput: s => ({ texto: s, setMimeType() { return this; } })
  },
  Utilities: {
    sleep: () => {},
    formatDate: (d, tz, fmt) =>
      d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  },
  Session: { getScriptTimeZone: () => 'America/Sao_Paulo' },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) }
};

const criar = new Function(
  ...Object.keys(stubs),
  codigo + '\n return { doGet, doPost, lerTudo, SENHA };'
);
const API = criar(...Object.values(stubs));

/* ---------- utilidades do teste ---------- */
let falhas = 0;
function ok(nome, real, esperado) {
  const a = JSON.stringify(real), b = JSON.stringify(esperado);
  const passou = a === b;
  if (!passou) falhas++;
  console.log((passou ? '  ok   ' : '  FALHA') + '  ' + nome);
  if (!passou) console.log('         obtido:   ' + a + '\n         esperado: ' + b);
}
const post = corpo => JSON.parse(API.doPost({ postData: { contents: JSON.stringify(corpo) } }).texto);
const get = () => JSON.parse(API.doGet().texto);
const SENHA = API.SENHA;

console.log('\n== leitura inicial ==');
ok('planilha vazia', get(), { ok: true, eventos: [] });

console.log('\n== senha ==');
ok('senha errada',   post({ acao: 'adicionar', senha: 'chute', evento: { data: '2026-10-14', titulo: 'x' } }),
                     { ok: false, erro: 'senha incorreta' });
ok('senha ausente',  post({ acao: 'verificar' }), { ok: false, erro: 'senha incorreta' });
ok('senha correta',  post({ acao: 'verificar', senha: SENHA }), { ok: true });
ok('nada foi gravado com senha errada', get().eventos.length, 0);

console.log('\n== adicionar ==');
let r = post({ acao: 'adicionar', senha: SENHA, evento: { data: '14/10/2026', tipo: 'prova', materia: 'Física', titulo: 'P2', obs: 'cap 3' } });
ok('adicionou', [r.ok, r.eventos.length], [true, 1]);
ok('data normalizada', r.eventos[0].data, '2026-10-14');
ok('campos gravados',
  [r.eventos[0].tipo, r.eventos[0].materia, r.eventos[0].titulo, r.eventos[0].obs],
  ['prova', 'Física', 'P2', 'cap 3']);
ok('ganhou id', r.eventos[0].id.length > 1, true);

const id1 = r.eventos[0].id;
r = post({ acao: 'adicionar', senha: SENHA, evento: { data: '2026-10-21', tipo: 'trabalho', materia: 'História', titulo: 'Seminário', obs: '' } });
const id2 = r.eventos.find(e => e.id !== id1).id;
ok('dois itens', r.eventos.length, 2);
ok('ids diferentes', id1 !== id2, true);

console.log('\n== editar ==');
r = post({ acao: 'editar', senha: SENHA, evento: { id: id1, data: '2026-10-15', tipo: 'prova', materia: 'Física', titulo: 'P2 remarcada', obs: 'cap 3 e 4' } });
const editado = r.eventos.find(e => e.id === id1);
const intacto = r.eventos.find(e => e.id === id2);
ok('editou o certo', [editado.titulo, editado.data, editado.obs], ['P2 remarcada', '2026-10-15', 'cap 3 e 4']);
ok('nao mexeu no outro', [intacto.titulo, intacto.data], ['Seminário', '2026-10-21']);
ok('continua com 2', r.eventos.length, 2);
ok('editar id inexistente', post({ acao: 'editar', senha: SENHA, evento: { id: 'nao-existe', data: '2026-01-01', titulo: 'x' } }),
   { ok: false, erro: 'item não encontrado' });

console.log('\n== remover ==');
r = post({ acao: 'remover', senha: SENHA, id: id1 });
ok('removeu 1', [r.ok, r.eventos.length], [true, 1]);
ok('sobrou o outro', r.eventos[0].id, id2);
ok('remover id inexistente', post({ acao: 'remover', senha: SENHA, id: 'nao-existe' }),
   { ok: false, erro: 'item não encontrado' });

console.log('\n== acoes invalidas ==');
ok('acao desconhecida', post({ acao: 'formatar-tudo', senha: SENHA }), { ok: false, erro: 'ação desconhecida' });
ok('corpo quebrado', JSON.parse(API.doPost({ postData: { contents: 'isso nao e json' } }).texto),
   { ok: false, erro: 'corpo da requisição inválido' });

console.log('\n== linhas problematicas na planilha ==');
const aba = planilha._abas['Calendario'];
aba.appendRow(['zz1', '2026-11-01', 'prova', 'Química', '', '']);          // sem titulo
aba.appendRow(['zz2', '', 'prova', 'Química', 'sem data', '']);            // sem data
aba.appendRow(['zz3', new Date(2026, 10, 20), 'prova', 'Arte', 'P1', '']); // data como Date
const lista = get().eventos;
ok('ignora sem titulo e sem data', lista.filter(e => e.id === 'zz1' || e.id === 'zz2').length, 0);
ok('aceita Date do Sheets', lista.find(e => e.id === 'zz3').data, '2026-11-20');

console.log('\n== data vinda do Sheets de outro contexto ==');
/* O Sheets devolve datas como Date, mas de um contexto diferente:
   `instanceof Date` pode falhar. Este objeto imita isso — parece
   uma data, responde getTime, mas nao e instanceof Date. */
function DataEstrangeira(y, m, d) { this._d = new Date(y, m, d); }
DataEstrangeira.prototype.getTime = function () { return this._d.getTime(); };
DataEstrangeira.prototype.toString = function () { return this._d.toString(); };
ok('nao e instanceof Date', new DataEstrangeira(2026, 10, 20) instanceof Date, false);

aba.appendRow(['zz4', new DataEstrangeira(2026, 10, 25), 'prova', 'Arte', 'P2', '']);
const achado = get().eventos.find(e => e.id === 'zz4');
ok('aceita Date de outro contexto', achado && achado.data, '2026-11-25');

console.log('\n== cabecalho ==');
ok('cabecalho criado', aba.dados[0], ['id', 'data', 'tipo', 'materia', 'titulo', 'obs']);

console.log('\n== limite de tamanho ==');
r = post({ acao: 'adicionar', senha: SENHA, evento: { data: '2026-12-01', tipo: 'aviso', materia: 'X', titulo: 'T'.repeat(900), obs: '' } });
ok('titulo cortado em 500', r.eventos.find(e => e.data === '2026-12-01').titulo.length, 500);

console.log(falhas === 0 ? '\nTODOS OS TESTES DO BACKEND PASSARAM' : '\n' + falhas + ' FALHA(S)');
process.exit(falhas ? 1 : 0);
