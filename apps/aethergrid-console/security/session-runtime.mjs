import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

export function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) throw new Error('password must contain 12–256 characters');
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
function fault(message, status) { return Object.assign(new Error(message), { status }); }
const digest = (token) => createHash('sha256').update(token).digest('hex');
export function createSessionRuntime({ env = process.env, now = Date.now } = {}) {
  const users = JSON.parse(env.AETHERGRID_AUTH_USERS || '[]');
  if (!Array.isArray(users) || users.some((u) => !/^[\w.@-]{1,80}$/.test(u.username) || ['.','..'].includes(u.username) || !['Viewer','Analyst','Administrator'].includes(u.role) || !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(u.passwordHash))) throw new Error('invalid authentication configuration');
  if(new Set(users.map(user=>user.username)).size !== users.length) throw new Error('duplicate authentication username');
  const enabled = users.length > 0;
  if (env.AETHERGRID_AUTH_REQUIRED === '1' && !enabled) throw new Error('authentication users required');
  const sessions = new Map();
  const attempts = new Map();
  function session(request) {
    const token = /(?:^|;\s*)aethergrid_session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.cookie || '')?.[1];
    const key = token ? digest(token) : '';
    const value = sessions.get(key);
    if (!value || value.expiresAt <= now()) { sessions.delete(key); return null; }
    return value;
  }
  function login(username, password, address = 'local') {
    const prior = attempts.get(address);
    if (prior && prior.until > now() && prior.count >= 8) throw fault('login_rate_limited',429);
    const entry = prior && prior.until > now() ? prior : {count:0,until:now()+60_000};
    attempts.set(address,entry); entry.count++;
    if (attempts.size > 10000) for (const [key,value] of attempts) if(value.until <= now()) attempts.delete(key);
    const user = users.find((u) => u.username === username);
    const [salt, expected] = (user?.passwordHash || `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
    const candidate = scryptSync(typeof password === 'string' ? password.slice(0,256) : '',salt,64);
    if (!timingSafeEqual(candidate,Buffer.from(expected,'hex')) || !user) throw fault('invalid_credentials',401);
    for(const [key,value] of sessions) if(value.expiresAt <= now()) sessions.delete(key);
    if(sessions.size >= 10000) throw fault('session_capacity',429);
    const token = randomBytes(32).toString('hex');
    const value = { user:{username:user.username,role:user.role},csrf:randomBytes(32).toString('hex'),expiresAt:now()+8*60*60*1000 };
    sessions.set(digest(token),value);
    return {...value,token};
  }
  function authorize(request,method,path) {
    if(!enabled) return {user:{username:'local-operator',role:'Administrator'},csrf:null,localOnly:true};
    const value=session(request);
    if(!value) throw fault('authentication_required',401);
    if(!['GET','HEAD'].includes(method)) {
      if(value.user.role === 'Viewer') throw fault('forbidden',403);
      if(/\/(reset|quantum\/.*jobs|runtime\/.*)$/.test(path) && value.user.role !== 'Administrator') throw fault('forbidden',403);
      const csrf=String(request.headers['x-aethergrid-csrf'] || '');
      if(csrf.length !== value.csrf.length || !timingSafeEqual(Buffer.from(csrf),Buffer.from(value.csrf))) throw fault('csrf_rejected',403);
    }
    return value;
  }
  function logout(request) {
    const token=/(?:^|;\s*)aethergrid_session=([a-f0-9]{64})/.exec(request.headers.cookie || '')?.[1];
    if(token) sessions.delete(digest(token));
  }
  return {enabled,login,session,authorize,logout};
}
