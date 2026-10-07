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
  bloco('function normalizarEvento(', '\n}'),
  bloco('function salvarCache(', '\n}'),
  bloco('function lerCache(', '\n}'),
  bloco('function aplicarCache(', '\n}'),
  bloco('function corMateria(', '\n}')
].join('\n\n');

/* O cache e o aplicarCache mexem em localStorage e no estado da
   pagina; o sandbox fornece os dois, mais um interruptor para
   simular navegador que bloqueia armazenamento (aba anonima). */
const prelude = `
  const CHAVE_CACHE = 'teste/cache';
  let eventos = [];
  let atualizadoEm = 0;
  let _loja = {};
  let _bloqueado = false;
  const localStorage = {
    getItem(k){ if(_bloqueado) throw new Error('bloqueado'); return k in _loja ? _loja[k] : null; },
    setItem(k, v){ if(_bloqueado) throw new Error('bloqueado'); _loja[k] = String(v); },
    removeItem(k){ delete _loja[k]; }
  };
`;

const M = new Function(prelude + fonte + `
  return {
    pad, paraISO, deISO, diasEntre, chave, normalizarTipo, normalizarEvento,
    salvarCache, lerCache, aplicarCache, corMateria,
    _eventos: () => eventos,
    _atualizadoEm: () => atualizadoEm,
    _crua: v => { _loja[CHAVE_CACHE] = v; },
    _limpar: () => { _loja = {}; eventos = []; atualizadoEm = 0; },
    _bloquear: v => { _bloqueado = v; }
  };
`)();

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

console.log('\n== cor por materia ==');
ok('mesmo nome, mesma cor',
  M.corMateria('Física') === M.corMateria('Física'), true);
ok('maiusculas nao mudam a cor',
  M.corMateria('FISICA'), M.corMateria('fisica'));
ok('acento nao muda a cor',
  M.corMateria('Física'), M.corMateria('Fisica'));
ok('espacos em volta nao mudam a cor',
  M.corMateria('  Física  '), M.corMateria('Física'));
ok('sem materia usa o tom neutro', M.corMateria(''), 'var(--m0)');
ok('null nao quebra', M.corMateria(null), 'var(--m0)');

/* A propriedade que o usuario pediu: a cor acompanha o nome, nao a
   posicao numa lista. Cadastrar uma materia nova nao pode repintar
   as que ja estavam. */
const materias = ['Português', 'Matemática', 'Física', 'Química', 'Biologia', 'História',
                  'Geografia', 'Filosofia', 'Sociologia', 'Inglês', 'Educação Física', 'Artes'];
const antes = materias.map(M.corMateria);
const depois = ['Espanhol', 'Redação'].concat(materias).map(M.corMateria).slice(2);
ok('materia nova nao repinta as outras', depois, antes);

materias.forEach(m => {
  const c = M.corMateria(m);
  if (!/^var\(--m(1[0-2]|[1-9])\)$/.test(c)) { falhas++; console.log('  FALHA  cor invalida para ' + m + ': ' + c); }
});
ok('todas as 12 materias caem em slots validos', true, true);
console.log('  (info) cores distintas entre as 12 materias de exemplo: ' + new Set(antes).size + ' de 12');

console.log('\n== cache (primeira pintura da pagina) ==');
const amostra = [
  { id: 'a', data: '2026-10-14', tipo: 'prova', materia: 'Física', titulo: 'P2', obs: '' },
  { id: 'b', data: '2026-10-21', tipo: 'trabalho', materia: 'História', titulo: 'Seminário', obs: 'x' }
];

M._limpar();
ok('sem cache: lerCache devolve null', M.lerCache(), null);
ok('sem cache: aplicarCache nao pinta nada', M.aplicarCache(), false);
ok('sem cache: eventos continuam vazios', M._eventos().length, 0);

M.salvarCache(amostra);
ok('ida e volta preserva a lista', M.lerCache().lista, amostra);
ok('aplicarCache pinta', M.aplicarCache(), true);
ok('eventos vieram do cache', M._eventos().map(e => e.titulo), ['P2', 'Seminário']);
ok('guardou o momento da leitura', M._atualizadoEm() > 0, true);

M._limpar();
M._crua('isso nao e json');
ok('cache corrompido nao lanca', M.lerCache(), null);
ok('cache corrompido: nao pinta', M.aplicarCache(), false);

M._limpar();
M._crua(JSON.stringify({ em: 1, lista: 'nao e array' }));
ok('cache com formato errado', M.lerCache(), null);

M._limpar();
M._crua(JSON.stringify({ em: 1, lista: [] }));
ok('cache vazio nao conta como pintura', M.aplicarCache(), false);

M._limpar();
M._crua(JSON.stringify({ em: 1, lista: [{ id: 'x', data: '', titulo: 'sem data' }, amostra[0]] }));
M.aplicarCache();
ok('descarta linha sem data', M._eventos().map(e => e.id), ['a']);

M._limpar();
M._bloquear(true);
ok('armazenamento bloqueado: lerCache null', M.lerCache(), null);
ok('armazenamento bloqueado: aplicarCache false', M.aplicarCache(), false);
let lancou = false;
try { M.salvarCache(amostra); } catch (e) { lancou = true; }
ok('armazenamento bloqueado: salvarCache nao lanca', lancou, false);
M._bloquear(false);

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
