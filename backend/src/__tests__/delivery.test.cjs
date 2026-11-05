const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let ts;
try { ts = require('typescript'); } catch {} if (!ts?.transpileModule) ts = require('../../../frontend/node_modules/typescript');

function setup(overrides = {}, role = '', reason, channel = 'counter') {
  const order = { id: 7, status: 'completed', discountPercent: 0, resultsDeliveredAt: null,
    items: [{ price: '100.00' }], payments: [], ...overrides };
  const logs = []; let rendered = 0; let updated = 0;
  const tx = { $queryRaw: async () => [], order: {
    findFirst: async () => order, update: async () => { updated++; },
  }, paymentLog: { create: async ({ data }) => { logs.push(data); } } };
  const prisma = { $transaction: async callback => callback(tx) };
  const source = fs.readFileSync(require('node:path').join(__dirname, '../services/delivery.service.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { exports: module.exports, require: name => {
    if (name === '../config/db') return { prisma };
    throw new Error(`Unexpected dependency ${name}`);
  }, Buffer, Date });
  return { logs, run: () => module.exports.releaseReport({ headers: { 'x-user-role': role, 'x-user-name': 'Ana' }, body: { reason } }, 1, 7, channel, async () => { rendered++; return Buffer.from('pdf'); }),
    rendered: () => rendered, updated: () => updated };
}

for (const channel of ['counter', 'email', 'portal', 'print']) {
  test(`bloquea saldo en ${channel} sin generar resultados`, async () => {
    const s = setup({}, '', undefined, channel);
    const result = await s.run();
    assert.equal(result.code, 'PAYMENT_REQUIRED'); assert.equal(result.balance, '100.00');
    assert.equal(result.paymentUrl, '/ordenes/cobro?orden=7');
    assert.equal(s.rendered(), 0); assert.equal(s.updated(), 0);
    assert.equal(s.logs[0].action, 'Entrega bloqueada');
    assert.match(s.logs[0].detail, new RegExp(channel));
  });
}
test('liquidar desbloquea automáticamente sin autorización persistente', async () => {
  const s = setup({ payments: [{ amount: '100.00', cancelled: false }] });
  assert.ok((await s.run()).buffer); assert.equal(s.updated(), 1);
});
test('pago parcial y pago cancelado no liberan', async () => {
  const s = setup({ payments: [{ amount: '40.00', cancelled: false }, { amount: '60.00', cancelled: true }] });
  assert.equal((await s.run()).balance, '60.00');
});
test('admin sin motivo sigue bloqueado', async () => {
  assert.equal((await setup({}, 'admin', ' ').run()).code, 'PAYMENT_REQUIRED');
});
test('recepcionista no puede autorizar aunque proporcione motivo', async () => {
  assert.equal((await setup({}, 'receptionist', 'Urgente').run()).code, 'PAYMENT_REQUIRED');
});
test('excepción registra motivo, usuario y saldo', async () => {
  const s = setup({}, 'admin', 'Urgencia autorizada');
  assert.ok((await s.run()).buffer);
  assert.equal(s.logs[0].action, 'Excepción de entrega autorizada');
  assert.match(s.logs[0].detail, /Urgencia autorizada/); assert.equal(s.logs[0].userName, 'Ana');
});
test('descuento se calcula en centavos y permite total cero', async () => {
  assert.ok((await setup({ discountPercent: 100 }).run()).buffer);
});
test('orden cancelada nunca se entrega', async () => {
  const s = setup({ status: 'cancelled' }, 'admin', 'Motivo');
  assert.equal((await s.run()).status, 409); assert.equal(s.rendered(), 0);
});

test('motivo demasiado largo no autoriza la excepción', async () => {
  assert.equal((await setup({}, 'admin', 'a'.repeat(1001)).run()).code, 'PAYMENT_REQUIRED');
});
test('cada nuevo acceso vuelve a comprobar el saldo', async () => {
  const payments = [];
  const s = setup({ payments });
  assert.equal((await s.run()).code, 'PAYMENT_REQUIRED');
  payments.push({ amount: '100.00', cancelled: false });
  assert.ok((await s.run()).buffer);
});
