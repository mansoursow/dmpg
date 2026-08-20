import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Eye, EyeOff, User, Lock, Phone, Mail, ArrowLeft } from 'lucide-react';
import api from '../api';
import { useToast } from '../components/Toast';
import styles from './Login.module.css';

// Le service ne dessert que le corridor Paris-Dakar : deux indicatifs suffisent.
const PAYS = {
  '+33':  { drapeau: '🇫🇷', nom: 'France',   exemple: '6 12 34 56 78' },
  '+221': { drapeau: '🇸🇳', nom: 'Sénégal',  exemple: '77 123 45 67' },
};

// Accepte 06…, +33 6…, 0033 6… ou 77… : on retire l'indicatif et les zéros de tête.
function normaliserTel(indicatif, saisie) {
  let n = String(saisie).replace(/\D/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  const sansPlus = indicatif.slice(1);
  if (n.startsWith(sansPlus)) n = n.slice(sansPlus.length);
  return n.replace(/^0+/, '');
}

export default function Login() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('mode') === 'register' ? 'register' : 'login');
  const [form, setForm] = useState({ prenom: '', nom: '', telephone: '', email: '', password: '' });
  const [indicatif, setIndicatif] = useState('+33');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (localStorage.getItem('dmgp_token')) {
      const user = JSON.parse(localStorage.getItem('dmgp_user') || '{}');
      navigate(user.role === 'admin' ? '/admin' : '/app', { replace: true });
    }
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();

    let charge = form;
    if (mode === 'register') {
      const num = normaliserTel(indicatif, form.telephone);
      if (num.length !== 9) {
        toast(`Numéro ${PAYS[indicatif].nom} invalide : 9 chiffres attendus (ex. ${PAYS[indicatif].exemple})`, 'error');
        return;
      }
      charge = { ...form, telephone: `${indicatif} ${num}` };
    }

    setLoading(true);
    const url = mode === 'login' ? '/auth/login' : '/auth/register';
    try {
      const { data } = await api.post(url, charge);
      localStorage.setItem('dmgp_token', data.token);
      localStorage.setItem('dmgp_user', JSON.stringify(data.user));
      toast(mode === 'login' ? `Bienvenue ${data.user.prenom} !` : `Compte créé ! Votre ID : ${data.user.gp_id}`, 'success');
      navigate(data.user.role === 'admin' ? '/admin' : '/app', { replace: true });
    } catch (err) {
      // Un message générique masque la cause : on distingue les trois cas.
      const rep = err.response;
      let msg;
      if (!rep)                       msg = 'Serveur injoignable — le backend tourne-t-il sur le port 3001 ?';
      else if (rep.data?.error)       msg = rep.data.error;
      // Le proxy Vite renvoie 500/502/504 quand le backend est éteint
      // ou en cours de redémarrage : la cause est là, pas dans le formulaire.
      else if (rep.status >= 500)     msg = 'Backend injoignable ou en cours de redémarrage (port 3001). Réessayez.';
      else                            msg = `Erreur ${rep.status} — réponse inattendue du serveur`;
      toast(msg, 'error');
      if (!rep?.data?.error) console.error('[DMgp]', url, rep?.status ?? err.message, rep?.data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.left}>
        <div className={styles.leftContent}>
          <Link to="/" className={styles.back}><ArrowLeft size={16}/> Retour au site</Link>
          <img src="/logo.png" alt="DMgp" className={styles.logo}/>
          <h1>DMgp Logistique</h1>
          <p>Votre passerelle de confiance<br/>Paris → Dakar</p>
          <div className={styles.leftStats}>
            <div><strong>10€</strong><span>/kg</span></div>
            <div><strong>Paris</strong><span>→ Dakar</span></div>
          </div>
        </div>
      </div>

      <div className={styles.right}>
        <div className={styles.formBox}>
          <div className={styles.tabs}>
            <button className={mode === 'login' ? styles.active : ''} onClick={() => setMode('login')}>
              Connexion
            </button>
            <button className={mode === 'register' ? styles.active : ''} onClick={() => setMode('register')}>
              S'inscrire
            </button>
          </div>

          <h2>{mode === 'login' ? 'Bon retour !' : 'Créer mon compte'}</h2>
          <p className={styles.sub}>
            {mode === 'login'
              ? 'Connectez-vous pour accéder à votre espace client'
              : 'Inscription gratuite — obtenez votre ID GP-XXXX instantanément'}
          </p>

          <form onSubmit={submit}>
            {mode === 'register' && (
              <div className={styles.row}>
                <div className="form-group">
                  <label>Prénom</label>
                  <div className={styles.inputWrap}>
                    <User size={16} className={styles.inputIcon}/>
                    <input className={styles.field} placeholder="Aminata" value={form.prenom} onChange={e => set('prenom', e.target.value)} required/>
                  </div>
                </div>
                <div className="form-group">
                  <label>Nom</label>
                  <div className={styles.inputWrap}>
                    <User size={16} className={styles.inputIcon}/>
                    <input className={styles.field} placeholder="Diallo" value={form.nom} onChange={e => set('nom', e.target.value)} required/>
                  </div>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div className="form-group">
                <label>Téléphone</label>
                <div className={styles.telWrap}>
                  <select
                    className={styles.telIndic}
                    value={indicatif}
                    onChange={e => setIndicatif(e.target.value)}
                    aria-label="Indicatif pays"
                  >
                    {Object.entries(PAYS).map(([code, p]) => (
                      <option key={code} value={code}>{p.drapeau} {code}</option>
                    ))}
                  </select>
                  <div className={styles.telChamp}>
                    <Phone size={16} className={styles.inputIcon}/>
                    <input
                      className={`${styles.field} ${styles.telNum}`}
                      type="tel" inputMode="tel"
                      placeholder={PAYS[indicatif].exemple}
                      value={form.telephone}
                      onChange={e => set('telephone', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <p className={styles.aide}>
                  Numéro {PAYS[indicatif].nom} — 9 chiffres, sans le zéro initial
                </p>
              </div>
            )}

            <div className="form-group">
              <label>Email</label>
              <div className={styles.inputWrap}>
                <Mail size={16} className={styles.inputIcon}/>
                <input className={styles.field} type="email" placeholder="vous@email.com" value={form.email} onChange={e => set('email', e.target.value)} required/>
              </div>
            </div>

            <div className="form-group">
              <label>Mot de passe</label>
              <div className={styles.inputWrap}>
                <Lock size={16} className={styles.inputIcon}/>
                <input
                  className={`${styles.field} ${styles.fieldEye}`}
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  required minLength={6}
                />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowPwd(!showPwd)}>
                  {showPwd ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            <button type="submit" className={`btn btn-primary ${styles.submitBtn}`} disabled={loading}>
              {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </button>
          </form>

          <p className={styles.switchMode}>
            {mode === 'login'
              ? <>Pas encore de compte ? <button onClick={() => setMode('register')}>S'inscrire gratuitement</button></>
              : <>Déjà un compte ? <button onClick={() => setMode('login')}>Se connecter</button></>
            }
          </p>

        </div>
      </div>
    </div>
  );
}
