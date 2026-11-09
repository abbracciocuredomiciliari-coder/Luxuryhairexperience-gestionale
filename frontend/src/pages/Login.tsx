import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.token, res.data.user);
      nav('/gestionale');
    } catch (e2: any) {
      setErr(e2?.response?.data?.message || 'Accesso non riuscito');
    } finally { setBusy(false); }
  };

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <div className="brandmark">LH</div>
        <h1>Luxury Hair Experience</h1>
        <p className="sub">Area riservata — gestione salone</p>
        {err && <div className="err mb">{err}</div>}
        <div className="field mb">
          <span>Email</span>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="info@luxuryhairexperience.it" />
        </div>
        <div className="field mb">
          <span>Password</span>
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <button className="btn" style={{ width: '100%', padding: '13px' }} disabled={busy}>
          {busy ? 'Accesso…' : 'Accedi'}
        </button>
      </form>
    </div>
  );
}
