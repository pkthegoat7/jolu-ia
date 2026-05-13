'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api';

type Role = 'ADMIN' | 'VIEWER';
type User = { id: string; email: string; name: string; role: Role; createdAt: string };
type Me   = { id: string; email: string; role: Role };

export default function AdminUsersPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const authFetch = useCallback(async (url: string, opts?: RequestInit) => {
    const res = await fetch(url, { ...opts, credentials: 'include' });
    if (res.status === 401) router.push('/admin');
    return res;
  }, [router]);

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, usersRes] = await Promise.all([
        authFetch(apiUrl('/auth/profile')),
        authFetch(apiUrl('/admin/users')),
      ]);
      if (meRes.ok) setMe(await meRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F2F5FA]">
        <div className="h-8 w-8 rounded-full border-2 border-[#0C417D]/30 border-t-[#0C417D] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F5FA] pb-16">
      <header className="sticky top-0 z-20 border-b border-[#DDE5F0]/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/admin/dashboard')}
              className="text-[12px] font-semibold text-[#0C417D] hover:underline">← Dashboard</button>
            <span className="text-[#C4D2E4]">·</span>
            <h1 className="font-display text-lg font-light text-[#072C57]">Usuários da clínica</h1>
          </div>
          {!creating && (
            <button onClick={() => setCreating(true)}
              className="btn-brand rounded-xl px-4 py-2 text-[13px] font-semibold">
              + Novo usuário
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-5">
        {msg && (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${
            msg.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}>{msg.text}</div>
        )}

        {creating && (
          <CreateForm
            authFetch={authFetch}
            onCancel={() => setCreating(false)}
            onCreated={async () => { setCreating(false); flash('ok', 'Usuário criado.'); await load(); }}
            onError={(t) => flash('err', t)}
          />
        )}

        <div className="space-y-3">
          {users.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#C4D2E4] p-10 text-center text-sm text-[#5A7299]">
              Nenhum usuário cadastrado.
            </p>
          ) : users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              isMe={me?.id === u.id}
              isEditing={editingId === u.id}
              confirmDelete={confirmDeleteId === u.id}
              onEdit={() => setEditingId(u.id)}
              onCancelEdit={() => setEditingId(null)}
              onAskDelete={() => setConfirmDeleteId(u.id)}
              onCancelDelete={() => setConfirmDeleteId(null)}
              onConfirmDelete={async () => {
                const res = await authFetch(apiUrl(`/admin/users/${u.id}`), { method: 'DELETE' });
                if (res.ok) { flash('ok', 'Usuário removido.'); setConfirmDeleteId(null); await load(); }
                else { const d = await res.json().catch(() => ({})); flash('err', d.message ?? 'Erro ao excluir.'); }
              }}
              authFetch={authFetch}
              onUpdated={async () => { setEditingId(null); flash('ok', 'Usuário atualizado.'); await load(); }}
              onError={(t) => flash('err', t)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
function CreateForm({
  authFetch, onCancel, onCreated, onError,
}: {
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  onCancel: () => void;
  onCreated: () => Promise<void>;
  onError: (text: string) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('VIEWER');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await authFetch(apiUrl('/admin/users'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      });
      if (res.ok) { await onCreated(); return; }
      const d = await res.json().catch(() => ({}));
      onError(d.message ?? 'Erro ao criar usuário.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass rounded-2xl p-6 space-y-4">
      <p className="text-sm font-semibold text-[#072C57]">Novo usuário</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" value={name} set={setName} required />
        <Field label="E-mail" value={email} set={setEmail} type="email" required />
        <Field label="Senha (mín. 8)" value={password} set={setPassword} type="password" required />
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0C417D]">Permissão</label>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="field">
            <option value="VIEWER">VIEWER (só leitura)</option>
            <option value="ADMIN">ADMIN (acesso total)</option>
          </select>
        </div>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel}
          className="flex-1 rounded-2xl border border-[#C4D2E4] bg-white py-3 text-sm font-semibold text-[#072C57]">
          Cancelar
        </button>
        <button type="submit" disabled={busy}
          className="btn-brand flex-1 rounded-2xl py-3 text-sm font-semibold disabled:opacity-55">
          {busy ? 'Criando…' : 'Criar usuário'}
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────
function UserRow({
  user, isMe, isEditing, confirmDelete,
  onEdit, onCancelEdit, onAskDelete, onCancelDelete, onConfirmDelete,
  authFetch, onUpdated, onError,
}: {
  user: User; isMe: boolean; isEditing: boolean; confirmDelete: boolean;
  onEdit: () => void; onCancelEdit: () => void;
  onAskDelete: () => void; onCancelDelete: () => void; onConfirmDelete: () => Promise<void>;
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  onUpdated: () => Promise<void>;
  onError: (text: string) => void;
}) {
  if (isEditing) {
    return <EditForm user={user} isMe={isMe} authFetch={authFetch} onCancel={onCancelEdit} onUpdated={onUpdated} onError={onError} />;
  }

  return (
    <div className="glass rounded-2xl p-5 flex items-center justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-[#072C57]">{user.name}</p>
          {isMe && <span className="rounded-full bg-[#E0E8F2] px-2 py-0.5 text-[10px] font-semibold text-[#0C417D]">você</span>}
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            user.role === 'ADMIN' ? 'bg-[#072C57] text-white' : 'bg-[#C4D2E4] text-[#072C57]'
          }`}>{user.role}</span>
        </div>
        <p className="text-[13px] text-[#5A7299]">{user.email}</p>
      </div>

      <div className="flex items-center gap-2">
        {confirmDelete ? (
          <>
            <span className="text-[12px] text-[#5A7299]">Confirmar?</span>
            <button onClick={onCancelDelete} className="rounded-lg border border-[#C4D2E4] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#072C57]">Não</button>
            <button onClick={onConfirmDelete} className="rounded-lg bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white">Excluir</button>
          </>
        ) : (
          <>
            <button onClick={onEdit} className="rounded-lg border border-[#C4D2E4] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#072C57] hover:bg-[#F4F7FB]">Editar</button>
            {!isMe && (
              <button onClick={onAskDelete} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-red-600 hover:bg-red-50">Excluir</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
function EditForm({
  user, isMe, authFetch, onCancel, onUpdated, onError,
}: {
  user: User; isMe: boolean;
  authFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  onCancel: () => void;
  onUpdated: () => Promise<void>;
  onError: (text: string) => void;
}) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<Role>(user.role);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body: Record<string, string> = { name, role };
      if (password.trim()) body.password = password;
      const res = await authFetch(apiUrl(`/admin/users/${user.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) { await onUpdated(); return; }
      const d = await res.json().catch(() => ({}));
      onError(d.message ?? 'Erro ao atualizar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass rounded-2xl p-5 space-y-4">
      <p className="text-sm font-semibold text-[#072C57]">Editar — {user.email}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" value={name} set={setName} required />
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0C417D]">Permissão</label>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}
            disabled={isMe && role === 'ADMIN'}
            className="field disabled:opacity-60">
            <option value="VIEWER">VIEWER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          {isMe && (
            <p className="text-[10px] text-[#7A91B0]">Você não pode rebaixar seu próprio acesso.</p>
          )}
        </div>
        <Field label="Nova senha (opcional)" value={password} set={setPassword} type="password" />
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel}
          className="flex-1 rounded-2xl border border-[#C4D2E4] bg-white py-3 text-sm font-semibold text-[#072C57]">
          Cancelar
        </button>
        <button type="submit" disabled={busy}
          className="btn-brand flex-1 rounded-2xl py-3 text-sm font-semibold disabled:opacity-55">
          {busy ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────
function Field({ label, value, set, type = 'text', required }: {
  label: string; value: string; set: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0C417D]">{label}</label>
      <input type={type} value={value} required={required}
        onChange={(e) => set(e.target.value)}
        className="field !pl-4" />
    </div>
  );
}
