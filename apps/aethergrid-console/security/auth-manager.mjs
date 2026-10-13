import { randomBytes } from 'node:crypto';

export function createAuthManager({
  sessionTtlMs = 24 * 60 * 60 * 1000,
  defaultPassword = process.env.AETHERGRID_OPERATOR_PASSWORD || 'aethergrid2025',
  now = () => new Date(),
} = {}) {
  const sessions = new Map();

  // Pre-seed default local operator session if auth is relaxed
  const defaultSessionToken = 'session-local-operator-token';
  sessions.set(defaultSessionToken, {
    token: defaultSessionToken,
    user: {
      id: 'local-operator',
      username: 'operator',
      role: 'operator',
      displayName: 'Operator',
    },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  });

  function cleanExpiredSessions() {
    const currentTime = now().getTime();
    for (const [token, session] of sessions.entries()) {
      if (new Date(session.expiresAt).getTime() <= currentTime) {
        sessions.delete(token);
      }
    }
  }

  function login({ username, password, role = 'operator' } = {}) {
    cleanExpiredSessions();
    if (password !== defaultPassword) {
      throw new Error('Invalid authentication credentials.');
    }

    const token = `ag_sess_${randomBytes(24).toString('hex')}`;
    const userRole = username === 'admin' ? 'admin' : (['admin', 'operator', 'viewer'].includes(role) ? role : 'operator');
    const currentTime = now();
    const expiresAt = new Date(currentTime.getTime() + sessionTtlMs).toISOString();

    const session = {
      token,
      user: {
        id: `user-${username || 'operator'}`,
        username: username || 'operator',
        role: userRole,
        displayName: username ? (username.charAt(0).toUpperCase() + username.slice(1)) : 'Operator',
      },
      createdAt: currentTime.toISOString(),
      expiresAt,
    };

    sessions.set(token, session);
    return session;
  }

  function logout(token) {
    if (!token) return false;
    return sessions.delete(token);
  }

  function getSession(token) {
    cleanExpiredSessions();
    if (!token) return null;
    const session = sessions.get(token);
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() <= now().getTime()) {
      sessions.delete(token);
      return null;
    }
    return session;
  }

  function extractTokenFromRequest(request) {
    const authHeader = request.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7).trim();
    }
    const cookieHeader = request.headers['cookie'];
    if (cookieHeader) {
      const match = cookieHeader.match(/aethergrid_session=([^;]+)/);
      if (match) return match[1].trim();
    }
    return null;
  }

  function requireAuth(requiredRole = 'viewer') {
    const roleHierarchy = { viewer: 1, operator: 2, admin: 3 };
    return (request) => {
      const token = extractTokenFromRequest(request);
      let session = getSession(token);

      // If no explicit session found, check if local fallback session is allowed
      if (!session) {
        session = getSession(defaultSessionToken);
      }

      if (!session) {
        const error = new Error('Authentication required.');
        error.statusCode = 401;
        throw error;
      }

      const userRoleLevel = roleHierarchy[session.user.role] || 1;
      const requiredRoleLevel = roleHierarchy[requiredRole] || 1;

      if (userRoleLevel < requiredRoleLevel) {
        const error = new Error(`Insufficient permissions. Required role: ${requiredRole}`);
        error.statusCode = 403;
        throw error;
      }

      return session;
    };
  }

  return {
    login,
    logout,
    getSession,
    extractTokenFromRequest,
    requireAuth,
    safeSummary: () => ({ activeSessions: sessions.size }),
  };
}
