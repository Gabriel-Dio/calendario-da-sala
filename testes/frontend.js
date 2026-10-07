/* Extrai as funcoes puras do index.html e testa datas, tipos,
   normalizacao de eventos e a cobertura da grade do mes. */
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/\r/g, '');

function bloco(inicio, fim) {
  const i = html.indexOf(inicio);
  if (i < 0) throw new Error('nao achei no index.html: ' + inicio);
  const j = html.indexOf(fim, i);
  if (j < 0) throw new Error('bloco nao fecha: ' + inicio);
  return html.slice(i, j + fim.length);
}

const fonte = [
  bloco('function pad(', '\n}'),
  bloco('function paraISO(', '\n}'),
  bloco('function deISO(', '\n}'),
  bloco('function diasEntre(', '\n}'),
  bloco('function chave(', '\n}'),
  bloco('function normalizarTipo(', '\n}'),
  bloco('function normalizarEvento(', '\n}')
].join('\n\n');

const M = new Function(
  fonte + '\n return { pad, paraISO, deISO, diasEntre, chave, normalizarTipo, normalizarEvento };'
)();

let falhas = 0;
function ok(nome, real, esperado) {
  const a = JSON.stringify(real), b = JSON.stringify(esperado);
  const passou = a === b;
  if (!passou) falhas++;
  console.log((passou ? '  ok   ' : '  FALHA') + '  ' + nome);
  if (!passou) console.log('         obtido:   ' + a + '\n         esperado: ' + b);
}

console.log('\n== datas ==');
ok('paraISO',               M.paraISO(new Date(2026, 9, 7)), '2026-10-07');
ok('paraISO com 1 digito',  M.paraISO(new Date(2027, 0, 5)), '2027-01-05');
ok('deISO volta certo',     M.paraISO(M.deISO('2026-10-14')), '2026-10-14');
ok('deISO nao desloca mes', M.deISO('2026-10-14').getMonth(), 9);
ok('diasEntre na semana',   M.diasEntre('2026-10-07', '2026-10-14'), 7);
ok('diasEntre virada ano',  M.diasEntre('2026-12-31', '2027-01-01'), 1);
ok('diasEntre mesmo dia',   M.diasEntre('2026-10-07', '2026-10-07'), 0);
ok('diasEntre negativo',    M.diasEntre('2026-10-14', '2026-10-07'), -7);
ok('ordem alfabetica = cronologica', '2026-11-05' > '2026-10-28', true);

console.log('\n== chave (acentos e maiusculas) ==');
ok('Matéria',       M.chave('Matéria'), 'materia');
ok('Observações',   M.chave('  OBSERVAÇÕES  '), 'observacoes');
ok('com pontuacao', M.chave('Título!'), 'titulo');
ok('vazio',         M.chave(null), '');

console.log('\n== tipos ==');
ok('Prova',             M.normalizarTipo('Prova'), 'prova');
ok('PROVA 2',           M.normalizarTipo('PROVA 2'), 'prova');
ok('Avaliacao',         M.normalizarTipo('Avaliação'), 'prova');
ok('Recuperacao',       M.normalizarTipo('Recuperação'), 'prova');
ok('trabalho em grupo', M.normalizarTipo('trabalho em grupo'), 'trabalho');
ok('Apresentacao',      M.normalizarTipo('Apresentação'), 'trabalho');
ok('Seminario',         M.normalizarTipo('Seminário'), 'trabalho');
ok('licao de casa',     M.normalizarTipo('Lição de casa'), 'entrega');
ok('Redacao',           M.normalizarTipo('Redação'), 'entrega');
ok('Prazo final',       M.normalizarTipo('Prazo final'), 'entrega');
ok('vazio -> aviso',    M.normalizarTipo(''), 'aviso');
ok('desconhecido',      M.normalizarTipo('passeio'), 'aviso');

console.log('\n== normalizarEvento ==');
ok('preenche o que falta', M.normalizarEvento({ data: '2026-10-14', titulo: 'P2' }),
  { id: '', data: '2026-10-14', tipo: 'aviso', materia: '', titulo: 'P2', obs: '' });
ok('aguenta null', M.normalizarEvento(null),
  { id: '', data: '', tipo: 'aviso', materia: '', titulo: '', obs: '' });
ok('tira espacos', M.normalizarEvento({ titulo: '  P2  ', materia: ' Física ' }).titulo, 'P2');
ok('tipo normalizado', M.normalizarEvento({ tipo: 'Lição de casa' }).tipo, 'entrega');

console.log('\n== grade: 42 celulas cobrem o mes inteiro ==');
let mesesRuins = 0;
for (let ano = 2025; ano <= 2030; ano++) {
  for (let mes = 0; mes < 12; mes++) {
    const inicio = new Date(ano, mes, 1).getDay();
    const base = new Date(ano, mes, 1 - inicio);
    const vistos = new Set();
    for (let i = 0; i < 42; i++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      if (d.getMonth() === mes && d.getFullYear() === ano) vistos.add(d.getDate());
    }
    const total = new Date(ano, mes + 1, 0).getDate();
    if (vistos.size !== total) { mesesRuins++; console.log('    falhou em ' + (mes + 1) + '/' + ano); }
  }
}
ok('72 meses sem dia faltando', mesesRuins, 0);

console.log(falhas === 0 ? '\nTODOS OS TESTES DO FRONTEND PASSARAM' : '\n' + falhas + ' FALHA(S)');
process.exit(falhas ? 1 : 0);
