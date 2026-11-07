import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, tokenHash } from './password.js';
test('senhas usam salt aleatório e verificam apenas a senha correta', async () => {
  const password = 'uma-senha-de-teste';
  const first = await hashPassword(password);
  assert.notEqual(first, await hashPassword(password));
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('incorreta', first), false);
  assert.equal(await verifyPassword(password, 'invalido'), false);
});
test('token é armazenado como hash determinístico', () => {
  assert.equal(tokenHash('abc'), tokenHash('abc'));
  assert.notEqual(tokenHash('abc'), 'abc');
  assert.notEqual(tokenHash('abc'), tokenHash('def'));
});
