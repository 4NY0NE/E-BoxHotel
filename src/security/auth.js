/**
 * E-BoxHotel — autenticação do painel de gestão.
 * Camada: segurança. Senha com PBKDF2-SHA-256 (WebCrypto) e sal aleatório, bloqueio temporário
 * após tentativas falhas, sessão com expiração por inatividade e trilha de auditoria.
 *
 * LIMITE CONHECIDO: o sistema roda só no navegador. Quem tem acesso ao aparelho pode apagar os dados
 * ou alterar o código. Estas defesas dificultam o acesso casual, mas só um servidor torna o admin seguro
 * (ver docs/seguranca.md).
 */
(function (root) {
  'use strict';
  const HB = (root.HB = root.HB || {});

  const CONFIG = Object.freeze({
    pbkdf2Iterations: 210000,
    maxAttempts: 5,
    lockMinutes: 15,
    sessionMinutes: 15,
    minPasswordLength: 10,
    minUsernameLength: 4,
  });
  const SESSION_KEY = 'hotelbox:session';

  const subtle = () => root.crypto && root.crypto.subtle;
  const enc = new TextEncoder();

  const toHex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  const fromHex = (hex) => Uint8Array.from(hex.match(/../g) || [], (h) => parseInt(h, 16));

  /** Comparação em tempo constante para evitar vazamento por tempo de resposta. */
  function safeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  async function deriveHash(password, saltHex, iterations) {
    if (!subtle()) throw new Error('Este navegador não oferece criptografia segura (use HTTPS ou localhost).');
    const key = await subtle().importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations }, key, 256);
    return toHex(bits);
  }

  function newSalt() {
    return toHex(root.crypto.getRandomValues(new Uint8Array(16)));
  }

  /** Política de senha. Devolve lista de mensagens; vazia quando a senha é aceita. */
  function passwordIssues(password, username) {
    const issues = [];
    const p = String(password ?? '');
    if (p.length < CONFIG.minPasswordLength) issues.push(`Use pelo menos ${CONFIG.minPasswordLength} caracteres.`);
    if (!/[a-z]/.test(p)) issues.push('Inclua uma letra minúscula.');
    if (!/[A-Z]/.test(p)) issues.push('Inclua uma letra maiúscula.');
    if (!/\d/.test(p)) issues.push('Inclua um número.');
    if (!/[^A-Za-z0-9]/.test(p)) issues.push('Inclua um símbolo.');
    if (username && p.toLowerCase().includes(String(username).toLowerCase())) issues.push('A senha não pode conter o nome de usuário.');
    return issues;
  }

  /**
   * @param {object} store repositório (HB.storage.createStore)
   * @param {object} session objeto com getItem/setItem/removeItem (sessionStorage ou memória)
   * @param {object} clock { now(): number }
   */
  function createAuth({ store, session, clock }) {
    const record = () => store.getAuth();
    const isConfigured = () => Boolean(record().hash);

    function lockRemainingMs() {
      const r = record();
      return r.lockedUntil && r.lockedUntil > clock.now() ? r.lockedUntil - clock.now() : 0;
    }

    async function setup(username, password) {
      if (isConfigured()) return { ok: false, error: 'O acesso já foi configurado.' };
      const user = String(username ?? '').trim();
      if (user.length < CONFIG.minUsernameLength || !/^[\w.-]+$/.test(user)) {
        return { ok: false, error: `O usuário deve ter ao menos ${CONFIG.minUsernameLength} caracteres (letras, números, ponto, hífen ou sublinhado).` };
      }
      const issues = passwordIssues(password, user);
      if (issues.length) return { ok: false, error: issues.join(' ') };
      const salt = newSalt();
      const hash = await deriveHash(password, salt, CONFIG.pbkdf2Iterations);
      store.setAuth({ username: user, salt, hash, iterations: CONFIG.pbkdf2Iterations, failures: 0, lockedUntil: 0, createdAt: new Date(clock.now()).toISOString() });
      store.appendAudit({ actor: user, action: 'acesso-configurado' });
      return startSession(user);
    }

    function startSession(user) {
      const token = toHex(root.crypto.getRandomValues(new Uint8Array(16)));
      session.setItem(SESSION_KEY, JSON.stringify({ user, token, expiresAt: clock.now() + CONFIG.sessionMinutes * 60000 }));
      return { ok: true, user };
    }

    async function login(username, password) {
      const r = record();
      if (!r.hash) return { ok: false, error: 'O acesso ainda não foi configurado.' };
      const remaining = lockRemainingMs();
      if (remaining > 0) {
        return { ok: false, locked: true, error: `Acesso bloqueado por tentativas excessivas. Tente novamente em ${Math.ceil(remaining / 60000)} min.` };
      }
      const derived = await deriveHash(String(password ?? ''), r.salt, r.iterations || CONFIG.pbkdf2Iterations);
      const userOk = safeEqual(String(username ?? '').trim().toLowerCase(), r.username.toLowerCase());
      const passOk = safeEqual(derived, r.hash);
      if (userOk && passOk) {
        store.setAuth({ ...r, failures: 0, lockedUntil: 0 });
        store.appendAudit({ actor: r.username, action: 'login' });
        return startSession(r.username);
      }
      const failures = (r.failures || 0) + 1;
      const locked = failures >= CONFIG.maxAttempts;
      store.setAuth({ ...r, failures: locked ? 0 : failures, lockedUntil: locked ? clock.now() + CONFIG.lockMinutes * 60000 : 0 });
      store.appendAudit({ actor: String(username ?? '').slice(0, 40) || '(vazio)', action: locked ? 'bloqueio-por-tentativas' : 'login-falhou' });
      return {
        ok: false,
        locked,
        error: locked
          ? `Acesso bloqueado por ${CONFIG.lockMinutes} minutos após ${CONFIG.maxAttempts} tentativas.`
          : `Usuário ou senha incorretos. ${CONFIG.maxAttempts - failures} tentativa(s) restante(s).`,
      };
    }

    /** Sessão atual ou null. Renova a expiração a cada verificação (inatividade). */
    function currentSession(renew = true) {
      try {
        const s = JSON.parse(session.getItem(SESSION_KEY) || 'null');
        if (!s || s.expiresAt <= clock.now()) {
          session.removeItem(SESSION_KEY);
          return null;
        }
        if (renew) session.setItem(SESSION_KEY, JSON.stringify({ ...s, expiresAt: clock.now() + CONFIG.sessionMinutes * 60000 }));
        return s;
      } catch {
        return null;
      }
    }

    function logout() {
      const s = currentSession(false);
      session.removeItem(SESSION_KEY);
      if (s) store.appendAudit({ actor: s.user, action: 'logout' });
    }

    async function changePassword(current, next) {
      const s = currentSession();
      const r = record();
      if (!s || !r.hash) return { ok: false, error: 'Sessão expirada. Entre novamente.' };
      const derived = await deriveHash(String(current ?? ''), r.salt, r.iterations || CONFIG.pbkdf2Iterations);
      if (!safeEqual(derived, r.hash)) return { ok: false, error: 'A senha atual está incorreta.' };
      const issues = passwordIssues(next, r.username);
      if (issues.length) return { ok: false, error: issues.join(' ') };
      const salt = newSalt();
      const hash = await deriveHash(next, salt, CONFIG.pbkdf2Iterations);
      store.setAuth({ ...r, salt, hash, iterations: CONFIG.pbkdf2Iterations });
      store.appendAudit({ actor: r.username, action: 'senha-alterada' });
      return { ok: true };
    }

    return { isConfigured, setup, login, logout, currentSession, changePassword, lockRemainingMs };
  }

  HB.auth = Object.freeze({ CONFIG, SESSION_KEY, passwordIssues, createAuth, deriveHash, newSalt, safeEqual });
})(typeof window !== 'undefined' ? window : globalThis);
