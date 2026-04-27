const SUPABASE_URL = 'https://xqyavopehirgwnaehwoj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxeWF2b3BlaGlyZ3duYWVod29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNDA5MzcsImV4cCI6MjA5MjgxNjkzN30.hz5cXZ55ggJV3RImQM_Rdt18EXCxD6YNo0g0gM2MVAg';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── 현재 로그인 유저 ─────────────────────────────────────
async function getCurrentUser() {
  const { data: { user } } = await _supabase.auth.getUser();
  return user;
}

// ── 이메일 회원가입 ──────────────────────────────────────
async function signUp(email, password) {
  const { data, error } = await _supabase.auth.signUp({ email, password });
  return { data, error };
}

// ── 이메일 로그인 ────────────────────────────────────────
async function signIn(email, password) {
  const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

// ── 로그아웃 ─────────────────────────────────────────────
async function signOut() {
  await _supabase.auth.signOut();
}

// ── 응답 데이터 저장 ──────────────────────────────────────
async function saveResponse(payload) {
  const { error } = await _supabase.from('responses').insert(payload);
  return error;
}
