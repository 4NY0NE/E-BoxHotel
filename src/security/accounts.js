/**
 * E-BoxHotel — contas de clientes (cadastro, entrada, saída, recuperação de senha).
 * Camada: segurança. Dois provedores com a mesma interface:
 *  - "supabase": Supabase Auth (quando HB.config tem URL e chave e a biblioteca está carregada);
 *  - "local": contas de demonstração neste navegador (PBKDF2-SHA-256, a senha nunca é gravada).
 */
(function (root) {
  'use strict';
  const HB = root.HB;
  const KEY_USERS = 'hotelbox:users';
  const KEY_SESSION = 'hotelbox:account-session';
  const KEY_FAILS = 'hotelbox:account-fails';
  const SESSION_MS = 12 * 60 * 60 * 1000;
  const MAX_FAILS = 5;
  const LOCK_MS = 15 * 60 * 1000;
  const ITER = 150000;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const normEmail = (e) => String(e || '').trim().toLowerCase();

  /** Política de senha de cliente: 8+ caracteres, maiúscula, minúscula e número. */
  function passwordIssues(p) {
    const s = String(p || ''); const out = [];
    if (s.length < 8) out.push('Use pelo menos 8 caracteres.');
    if (!/[a-z]/.test(s)) out.push('Inclua uma letra minúscula.');
    if (!/[A-Z]/.test(s)) out.push('Inclua uma letra maiúscula.');
    if (!/\d/.test(s)) out.push('Inclua um número.');
    return out;
  }

  function validateSignUp({ name, email, password }) {
    const e = {};
    if (String(name || '').trim().length < 3) e.name = 'Informe seu nome completo.';
    if (!EMAIL_RE.test(normEmail(email))) e.email = 'Informe um e-mail válido.';
    const pi = passwordIssues(password); if (pi.length) e.password = pi.join(' ');
    return e;
  }

  const friendly = (msg) => {
    const m = String(msg || '');
    if (/invalid login/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/already registered|already been registered/i.test(m)) return 'Este e-mail já possui cadastro. Entre ou recupere a senha.';
    if (/not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
    if (/rate limit|too many/i.test(m)) return 'Muitas tentativas. Aguarde alguns minutos.';
    if (/network|fetch/i.test(m)) return 'Sem conexão com o servidor. Tente novamente.';
    if (/invalid.*email|email.*invalid|unable to validate email/i.test(m)) return 'Informe um e-mail válido.';
    if (/password.*(weak|short|at least)|weak password/i.test(m)) return 'Senha fraca. Use 8 ou mais caracteres, com maiúscula, minúscula e número.';
    if (/same.*password|different from the old/i.test(m)) return 'Escolha uma senha diferente da atual.';
    if (/signups? not allowed|signup.*disabled/i.test(m)) return 'Novos cadastros estão desativados no momento.';
    return 'Não foi possível concluir. Tente novamente.';
  };

  function createAccounts({ backend, clock, config, sdk }) {
    const cfg = config || {};
    const cloud = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && sdk && sdk.createClient);
    const mode = cloud ? 'supabase' : 'local';
    const listeners = new Set();
    const recoveryListeners = new Set();
    let user = null;
    const emit = () => listeners.forEach((fn) => { try { fn(user); } catch { /* ouvinte não deve quebrar a autenticação */ } });
    const read = (k, d) => { try { const v = backend.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
    const write = (k, v) => backend.setItem(k, JSON.stringify(v));
    let client = null;
    let readyPromise = Promise.resolve();

    const fromSb = (u) => (u ? { id: u.id, email: u.email, name: (u.user_metadata && u.user_metadata.name) || u.email } : null);

    if (cloud) {
      // PKCE: o retorno dos e-mails (confirmação e recuperação) vem em ?code=..., sem conflitar com as rotas "#..." do site.
      client = sdk.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } });
      readyPromise = client.auth.getSession().then(({ data }) => { user = fromSb(data.session && data.session.user); emit(); }).catch(() => {});
      client.auth.onAuthStateChange((ev, session) => {
        user = fromSb(session && session.user); emit();
        if (ev === 'PASSWORD_RECOVERY') recoveryListeners.forEach((fn) => { try { fn(); } catch { /* ouvinte não deve quebrar a autenticação */ } });
      });
    } else {
      const s = read(KEY_SESSION, null);
      if (s && s.exp > clock.now() && read(KEY_USERS, {})[s.email]) user = { id: s.id, email: s.email, name: s.name };
    }

    /* ---------- provedor local ---------- */
    const idFor = (email) => `u-${HB.util.hash32(email)}`;
    function lockInfo(email) {
      const f = read(KEY_FAILS, {})[email]; if (!f) return 0;
      return f.count >= MAX_FAILS && f.until > clock.now() ? f.until - clock.now() : 0;
    }
    function fail(email, reset) {
      const all = read(KEY_FAILS, {});
      if (reset) delete all[email]; else {
        const f = all[email] && all[email].until > clock.now() ? all[email] : { count: 0 };
        f.count += 1; f.until = clock.now() + LOCK_MS; all[email] = f;
      }
      write(KEY_FAILS, all);
    }
    function startLocal(rec, email) {
      user = { id: idFor(email), email, name: rec.name };
      write(KEY_SESSION, { ...user, exp: clock.now() + SESSION_MS });
      emit();
    }

    async function signUp(input) {
      const errors = validateSignUp(input);
      if (Object.keys(errors).length) return { ok: false, fields: errors, error: Object.values(errors)[0] };
      const email = normEmail(input.email); const name = String(input.name).trim();
      if (cloud) {
        const { data, error } = await client.auth.signUp({ email, password: input.password, options: { data: { name }, emailRedirectTo: root.location && root.location.href.split('#')[0] } });
        if (error) return { ok: false, error: friendly(error.message) };
        return { ok: true, needsConfirm: !data.session };
      }
      const users = read(KEY_USERS, {});
      if (users[email]) return { ok: false, fields: { email: 'Este e-mail já possui cadastro.' }, error: 'Este e-mail já possui cadastro.' };
      const salt = HB.auth.newSalt();
      users[email] = { name, salt, iter: ITER, hash: await HB.auth.deriveHash(input.password, salt, ITER), createdAt: new Date(clock.now()).toISOString() };
      write(KEY_USERS, users);
      startLocal(users[email], email);
      return { ok: true };
    }

    async function signIn({ email, password }) {
      const em = normEmail(email);
      if (!EMAIL_RE.test(em) || !password) return { ok: false, error: 'Informe e-mail e senha.' };
      if (cloud) {
        const { error } = await client.auth.signInWithPassword({ email: em, password });
        return error ? { ok: false, error: friendly(error.message) } : { ok: true };
      }
      const wait = lockInfo(em);
      if (wait) return { ok: false, error: `Acesso bloqueado por tentativas excessivas. Tente novamente em ${Math.ceil(wait / 60000)} min.` };
      const rec = read(KEY_USERS, {})[em];
      // calcula o hash mesmo sem cadastro, para não revelar se o e-mail existe pelo tempo de resposta
      const derived = await HB.auth.deriveHash(password, rec ? rec.salt : '00'.repeat(16), rec ? rec.iter : ITER);
      if (!rec || !HB.auth.safeEqual(derived, rec.hash)) { fail(em); return { ok: false, error: 'E-mail ou senha incorretos.' }; }
      fail(em, true); startLocal(rec, em);
      return { ok: true };
    }

    async function signOut() {
      if (cloud) await client.auth.signOut().catch(() => {});
      else backend.removeItem(KEY_SESSION);
      user = null; emit();
    }

    async function resetPassword(email) {
      const em = normEmail(email);
      if (!EMAIL_RE.test(em)) return { ok: false, error: 'Informe um e-mail válido.' };
      if (cloud) {
        const { error } = await client.auth.resetPasswordForEmail(em, { redirectTo: root.location && root.location.href.split('#')[0] });
        return error ? { ok: false, error: friendly(error.message) } : { ok: true, message: 'Se o e-mail estiver cadastrado, enviaremos um link para criar uma nova senha.' };
      }
      return { ok: true, message: 'Na versão de demonstração não há envio de e-mail. Crie uma nova conta com outro e-mail.' };
    }

    /** Define a nova senha depois de abrir o link de recuperação enviado por e-mail (somente com Supabase). */
    async function updatePassword(password) {
      const issues = passwordIssues(password);
      if (issues.length) return { ok: false, fields: { password: issues.join(' ') }, error: issues[0] };
      if (!cloud || !user) return { ok: false, error: 'Abra o link de recuperação enviado ao seu e-mail.' };
      const { error } = await client.auth.updateUser({ password });
      return error ? { ok: false, error: friendly(error.message) } : { ok: true };
    }

    return {
      mode, current: () => user, ready: () => readyPromise, signUp, signIn, signOut, resetPassword, updatePassword,
      onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
      onRecovery: (fn) => { recoveryListeners.add(fn); return () => recoveryListeners.delete(fn); },
    };
  }

  HB.accounts = Object.freeze({ createAccounts, passwordIssues, validateSignUp });
})(typeof window !== 'undefined' ? window : globalThis);
