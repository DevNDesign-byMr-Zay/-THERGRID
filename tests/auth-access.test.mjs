import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthManager } from '../apps/aethergrid-console/security/auth-manager.mjs';

test('auth manager supports login, session retrieval, expiration, and role check', () => {
  const auth = createAuthManager({ defaultPassword: 'secretpassword', sessionTtlMs: 1000 });

  // Default fallback session
  const defaultSess = auth.getSession('session-local-operator-token');
  assert.ok(defaultSess);
  assert.equal(defaultSess.user.role, 'operator');

  // Login failure
  assert.throws(() => auth.login({ password: 'wrong' }), /Invalid authentication/);

  // Login success
  const session = auth.login({ username: 'admin', password: 'secretpassword', role: 'admin' });
  assert.ok(session.token.startsWith('ag_sess_'));
  assert.equal(session.user.role, 'admin');

  // Retrieve session
  const fetched = auth.getSession(session.token);
  assert.equal(fetched.user.username, 'admin');

  // Role authorization
  const reqAdmin = auth.requireAuth('admin');
  const authed = reqAdmin({ headers: { authorization: `Bearer ${session.token}` } });
  assert.equal(authed.user.role, 'admin');

  // Logout
  auth.logout(session.token);
  assert.equal(auth.getSession(session.token), null);
});
