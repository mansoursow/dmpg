import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Plus, User, Copy, CheckCheck,
  LogOut, Bell, Upload, QrCode, ChevronDown, MapPin, Menu, X,
  SlidersHorizontal, RotateCw, Search, Plane, Clock, Truck,
  CheckCircle2, Globe, LifeBuoy, MessageCircle, PhoneCall, AlertTriangle,
  Receipt, Barcode
} from 'lucide-react';
import QRCode from 'qrcode';
import api from '../api';
import { useToast } from '../components/Toast';
import { SUPPORT, waLien, urlSuivi } from '../support';
import styles from './ClientApp.module.css';

// Ligne directe et URL de suivi : voir src/support.js
export { SUPPORT, waLien } from '../support';

const NAV = [
  { id: 'dashboard', icon: <LayoutDashboard size={20}/>, label: 'Dashboard' },
  { id: 'colis',     icon: <Package size={20}/>,         label: 'Mes colis' },
  { id: 'declare',   icon: <Plus size={20}/>,            label: 'Déclarer' },
  { id: 'profile',   icon: <User size={20}/>,            label: 'Profil' },
  { id: 'support',   icon: <LifeBuoy size={20}/>,        label: 'Support' },
];

const STATUS = {
  attente:      { label: 'En attente',  color: '#7A7B98', bg: '#F2F3F9', icon: <Clock size={16}/> },
  'recu-paris': { label: 'Reçu Paris',  color: '#12855A', bg: '#DFF6E9', icon: <CheckCircle2 size={16}/> },
  transit:      { label: 'En transit',  color: '#B26B00', bg: '#FFEDD0', icon: <Truck size={16}/> },
  dakar:        { label: 'À Dakar',     color: '#3B49B0', bg: '#DCE4FF', icon: <Globe size={16}/> },
  livre:        { label: 'Livré',       color: '#5B3FB8', bg: '#E8E2FF', icon: <CheckCircle2 size={16}/> },
};

const FOURNISSEURS = ['Shein','Amazon','Bershka','H&M','Zara','AliExpress','Shopfrc','Autre'];

const DEPOT = {
  'Complément':  'Magasin Mr Diop',
  'Adresse':     '14 Boulevard de la Chapelle',
  'Code postal': '75018',
  'Ville':       'Paris',
  'Pays':        'France',
  'Tél':         '0758509931',
};

export default function ClientApp() {
  const [view, setView]   = useState('dashboard');
  const [user, setUser]   = useState(JSON.parse(localStorage.getItem('dmgp_user') || 'null'));
  const [colis, setColis] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [colisRes, notifRes, meRes] = await Promise.all([
        api.get('/colis'),
        api.get('/notifications'),
        api.get('/auth/me'),
      ]);
      setColis(colisRes.data);
      setNotifs(notifRes.data);
      setUser(meRes.data);
      localStorage.setItem('dmgp_user', JSON.stringify(meRes.data));
    } catch {
      toast('Erreur de chargement', 'error');
    } finally { setLoading(false); }
  }

  function logout() {
    localStorage.removeItem('dmgp_token');
    localStorage.removeItem('dmgp_user');
    navigate('/login');
  }

  function go(id) { setView(id); setMenuOpen(false); }

  if (loading) return <div className="loader"><div className="spinner"/><span>Chargement…</span></div>;

  const unread = notifs.filter(n => !n.read).length;

  return (
    <div className={styles.shell}>
      {/* ── NAV ── */}
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <img src="/logo.png" alt="DMgp" className={styles.navLogo}/>

          <nav className={`${styles.navMenu} ${menuOpen ? styles.menuOpen : ''}`}>
            {NAV.map(n => (
              <button
                key={n.id}
                className={`${styles.navLink} ${view === n.id ? styles.navLinkActive : ''}`}
                onClick={() => go(n.id)}
              >
                {n.icon} {n.label}
              </button>
            ))}
          </nav>

          <button className={`btn btn-primary btn-sm ${styles.navCta}`} onClick={() => go('declare')}>
            Déclarer un colis
          </button>

          <div className={styles.navRight}>
            <button
              className={styles.iconBtn}
              onClick={() => { go('profile'); if (unread) api.patch('/notifications/read-all'); }}
              aria-label="Notifications"
            >
              <Bell size={19}/>
              {unread > 0 && <span className={styles.badge}>{unread}</span>}
            </button>
            <button className={styles.avatarBtn} onClick={() => go('profile')}>
              <span className={styles.avatarCircle}>{(user?.prenom?.[0] || '?').toUpperCase()}</span>
              <ChevronDown size={16}/>
            </button>
            <button className={styles.burger} onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
              {menuOpen ? <X size={24}/> : <Menu size={24}/>}
            </button>
          </div>
        </div>
      </header>

      {/* ── CONTENU ── */}
      {view === 'dashboard' && (
        <main className={styles.main}>
          <div className={styles.col}>
            <PromoCard onAction={() => go('declare')}/>
            <ProfilePanel user={user} colis={colis}/>
          </div>
          <div className={styles.col}>
            <ExpeditionPanel colis={colis} onRefresh={loadData}/>
          </div>
        </main>
      )}

      {view === 'colis' && (
        <main className={`${styles.main} ${styles.mainSingle}`}>
          <div className={styles.col}><ColisView colis={colis} onRefresh={loadData}/></div>
        </main>
      )}

      {view === 'declare' && (
        <main className={`${styles.main} ${styles.mainSingle}`}>
          <div className={styles.col}>
            <DeclareView toast={toast} onSuccess={() => { loadData(); go('colis'); }}/>
          </div>
        </main>
      )}

      {view === 'support' && (
        <main className={`${styles.main} ${styles.mainSingle}`}>
          <div className={styles.col}><SupportView prenom={user?.prenom} gpId={user?.gp_id}/></div>
        </main>
      )}

      {view === 'profile' && (
        <main className={`${styles.main} ${styles.mainSingle}`}>
          <div className={styles.col}>
            <ProfileView user={user} notifs={notifs} onLogout={logout}/>
          </div>
        </main>
      )}

      <a
        className={styles.waBulle}
        href={waLien(`Bonjour DMgp, je suis ${user?.prenom} ${user?.nom} (${user?.gp_id}).`)}
        target="_blank" rel="noreferrer"
        aria-label="Nous écrire sur WhatsApp"
      >
        <MessageCircle size={26}/>
        <span>Besoin d'aide ?</span>
      </a>
    </div>
  );
}

/* ════════════ SUPPORT ════════════ */
function SupportView({ prenom, gpId }) {
  const msg = `Bonjour DMgp, je suis ${prenom} (${gpId}). `;
  return (
    <div className={styles.panel}>
      <div className={styles.panelTitle}>Une question ? Écrivez-nous</div>
      <div className={styles.panelSub}>
        Un doute sur une commande, un colis qui tarde, une adresse à vérifier :
        n'attendez pas, contactez-nous directement. Nous répondons vite, et il
        vaut toujours mieux poser la question avant que le colis parte.
      </div>

      <div className={styles.supportRow}>
        <a className={styles.supportCard} href={waLien(msg)} target="_blank" rel="noreferrer">
          <span className={`${styles.supportIcon} ${styles.supportIconWa}`}><MessageCircle size={26}/></span>
          <div>
            <div className={styles.supportTitre}>WhatsApp</div>
            <div className={styles.supportMeta}>{SUPPORT.numero} — réponse rapide</div>
          </div>
        </a>
        <a className={styles.supportCard} href={`tel:${SUPPORT.tel}`}>
          <span className={styles.supportIcon}><PhoneCall size={26}/></span>
          <div>
            <div className={styles.supportTitre}>Nous appeler</div>
            <div className={styles.supportMeta}>{SUPPORT.numero}</div>
          </div>
        </a>
      </div>

      <div className={styles.supportAstuce}>
        <AlertTriangle size={19}/>
        <span>
          Pour aller plus vite, indiquez votre identifiant <strong>{gpId}</strong> et,
          si votre message concerne un colis, sa référence <strong>DMG-…</strong>.
        </span>
      </div>
    </div>
  );
}

/* ════════════ CARTE PROMO ════════════
   Emplacement prévu pour une vraie photo : déposez-la dans
   public/promo.jpg et elle remplacera l'aplat orange. */
function PromoCard({ onAction }) {
  const [hasArt, setHasArt] = useState(true);
  return (
    <div className={styles.promo}>
      {hasArt && (
        <>
          <img src="/promo.jpg" alt="" className={styles.promoArt} onError={() => setHasArt(false)}/>
          <div className={styles.promoScrim}/>
        </>
      )}
      <Bell size={22} className={styles.promoBell}/>
      <div className={styles.promoBody}>
        <div className={styles.promoTitle}>Un tarif unique : 10 € le kilo</div>
        <button className={styles.promoLink} onClick={onAction}>Déclarer un colis</button>
      </div>
    </div>
  );
}

/* ════════════ PANNEAU PROFIL + ADRESSE ════════════ */
function ProfilePanel({ user, colis }) {
  const [open, setOpen] = useState('depot');
  const [copied, setCopied] = useState('');
  const toast = useToast();

  const stats = {
    total:   colis.length,
    encours: colis.filter(c => ['attente','recu-paris','transit','dakar'].includes(c.status)).length,
    livre:   colis.filter(c => c.status === 'livre').length,
  };

  const nomExpedition = `${user?.prenom} ${user?.nom} – ${user?.gp_id}`;
  const fields = { 'Nom': nomExpedition, ...DEPOT };

  function copy(k, v) {
    navigator.clipboard.writeText(v).then(() => {
      setCopied(k); setTimeout(() => setCopied(''), 1800);
      toast('Copié !', 'success');
    });
  }

  return (
    <div className={styles.panel}>
      <div className={styles.userName}>
        {user?.prenom} {user?.nom} <span className={styles.userId}>[{user?.gp_id}]</span>
      </div>

      <div className={styles.statRow}>
        <div className={styles.statTile}>
          <span className={styles.statLabel}>Colis</span>
          <span className={styles.statValue}>{stats.total}</span>
        </div>
        <div className={`${styles.statTile} ${styles.statWarn}`}>
          <span className={styles.statLabel}>En cours</span>
          <span className={styles.statValue}>{stats.encours}</span>
        </div>
        <div className={`${styles.statTile} ${styles.statOk}`}>
          <span className={styles.statLabel}>Livrés</span>
          <span className={styles.statValue}>{stats.livre}</span>
        </div>
      </div>

      <div className={styles.sep}/>

      <div className={styles.blockTitle}>Mon adresse</div>

      {/* Un seul corridor : la France est le seul pays de réception. */}
      <div className={styles.pillRow}>
        <span className={`${styles.countryPill} ${styles.countryActive}`}>🇫🇷 France</span>
        <span className={styles.countryPill}>🇸🇳 Livraison Dakar</span>
      </div>

      <div className={styles.accordion}>
        <div className={`${styles.accItem} ${open === 'depot' ? styles.accOpen : ''}`}>
          <button className={styles.accHead} onClick={() => setOpen(open === 'depot' ? '' : 'depot')}>
            <span className={styles.accIcon}><MapPin size={19}/></span>
            <span className={styles.accLabel}>Dépôt Paris</span>
            <ChevronDown size={18} className={styles.accChevron}/>
          </button>
          {open === 'depot' && (
            <div className={styles.accBody}>
              <div className={styles.addrNote}>
                <MapPin size={18}/>
                <span>
                  Saisissez cette adresse <strong>telle quelle</strong> lors de vos commandes.
                </span>
              </div>

              {/* Sans cet identifiant sur le colis, impossible de savoir à qui il appartient. */}
              <div className={styles.gpAlerte}>
                <div className={styles.gpAlerteTexte}>
                  <strong>N'oubliez jamais votre identifiant</strong>
                  <p>
                    C'est lui qui nous permet de rattacher un colis à votre compte
                    à son arrivée à Paris. Un colis sans identifiant ne peut pas être attribué.
                  </p>
                </div>
                <button className={styles.gpCode} onClick={() => copy('gp', user?.gp_id)}>
                  {user?.gp_id}
                  {copied === 'gp' ? <CheckCheck size={18}/> : <Copy size={18}/>}
                </button>
              </div>
              {Object.entries(fields).map(([k, v]) => (
                <div key={k} className={styles.addrRow}>
                  <div className={styles.addrKey}>{k}</div>
                  <div className={styles.addrVal}>{v}</div>
                  <button className={styles.copyBtn} onClick={() => copy(k, v)} aria-label={`Copier ${k}`}>
                    {copied === k ? <CheckCheck size={16} className="text-orange"/> : <Copy size={16}/>}
                  </button>
                </div>
              ))}
              <button
                className={`btn btn-primary ${styles.copyAll}`}
                onClick={() => copy('all', Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n'))}
              >
                {copied === 'all'
                  ? <><CheckCheck size={18}/> Adresse copiée</>
                  : <><Copy size={18}/> Copier toute l'adresse</>}
              </button>
            </div>
          )}
        </div>

        <div className={`${styles.accItem} ${open === 'route' ? styles.accOpen : ''}`}>
          <button className={styles.accHead} onClick={() => setOpen(open === 'route' ? '' : 'route')}>
            <span className={styles.accIcon}><Plane size={19}/></span>
            <span className={styles.accLabel}>Acheminement Paris → Dakar</span>
            <ChevronDown size={18} className={styles.accChevron}/>
          </button>
          {open === 'route' && (
            <div className={styles.accBody}>
              <div className={styles.addrRow}>
                <div className={styles.addrKey}>Tarif</div>
                <div className={styles.addrVal}>10 € / kg, suivi compris</div>
              </div>
              <div className={styles.addrRow}>
                <div className={styles.addrKey}>Départ</div>
                <div className={styles.addrVal}>Paris 18ᵉ — Magasin Mr Diop</div>
              </div>
              <div className={styles.addrRow}>
                <div className={styles.addrKey}>Arrivée</div>
                <div className={styles.addrVal}>Dakar, Sénégal</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════ TABLEAU DES EXPÉDITIONS ════════════ */
function ExpeditionPanel({ colis, onRefresh }) {
  const [q, setQ] = useState('');
  const [openFilter, setOpenFilter] = useState(false);
  const [filter, setFilter] = useState('');
  const [qrColis, setQrColis] = useState(null);
  const [qrUrl, setQrUrl] = useState('');

  const filtered = colis.filter(c => {
    if (filter && c.status !== filter) return false;
    if (!q) return true;
    const hay = `${c.ref} ${c.tracking_num || ''} ${c.num_commande || ''} ${c.fournisseur || ''}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  async function showQR(c) {
    setQrColis(c);
    // Une URL, pas du texte : un scan ouvre directement la fiche de suivi.
    setQrUrl(await QRCode.toDataURL(urlSuivi(c.ref), {
      width: 260, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#1E193D' },
    }));
  }

  function downloadQR() {
    const a = document.createElement('a');
    a.href = qrUrl; a.download = `dmgp-${qrColis.ref}.png`; a.click();
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <div className={styles.panelTitle}>Expédition</div>
        <div className={styles.tools}>
          <button className={styles.toolBtn} onClick={() => setOpenFilter(!openFilter)}>
            Filtrer <SlidersHorizontal size={17}/>
          </button>
          <button className={`${styles.toolBtn} ${styles.toolSquare}`} onClick={onRefresh} aria-label="Actualiser">
            <RotateCw size={17}/>
          </button>
          <div className={styles.searchBox}>
            <input placeholder="Rechercher" value={q} onChange={e => setQ(e.target.value)}/>
            <Search size={18} className={styles.searchIcon}/>
          </div>
        </div>
      </div>

      {openFilter && (
        <div className={styles.filterBar}>
          {['', 'attente', 'recu-paris', 'transit', 'dakar', 'livre'].map(s => (
            <button
              key={s}
              className={`${styles.filterBtn} ${filter === s ? styles.filterActive : ''}`}
              onClick={() => setFilter(s)}
            >
              {s ? STATUS[s].label : 'Tous'}
            </button>
          ))}
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>N° Tracking</th>
              <th><span className={styles.thSort}>Statut <ChevronDown size={15}/></span></th>
              <th><span className={styles.thSort}>Estimation (€) <ChevronDown size={15}/></span></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={4} className={styles.emptyCell}>Aucun élément trouvé.</td></tr>
            ) : filtered.map(c => {
              const s = STATUS[c.status] || STATUS.attente;
              return (
                <tr key={c.id}>
                  <td>
                    <div className={styles.cellStrong}>{c.tracking_num || c.fournisseur || 'Colis'}</div>
                    <div className={styles.cellMono}>
                      {c.ref}{c.num_commande ? ` · cmd ${c.num_commande}` : ''}
                    </div>
                  </td>
                  <td><span className="pill" style={{ background: s.bg, color: s.color }}>{s.label}</span></td>
                  <td>{c.poids ? `${(c.poids * 10).toFixed(0)} €` : '—'}</td>
                  <td>
                    <button className={styles.rowBtn} onClick={() => showQR(c)} aria-label="QR code">
                      <QrCode size={17}/>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {qrColis && (
        <div className="modal-overlay" onClick={() => setQrColis(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>QR Code — {qrColis.ref}</h3>
            <div style={{ textAlign: 'center', margin: '22px 0' }}>
              <img src={qrUrl} alt="QR" style={{ borderRadius: 12, border: '1px solid var(--warm-line)' }}/>
              <p style={{ fontSize: 16, color: 'var(--muted)', marginTop: 12 }}>
                {qrColis.fournisseur} · {qrColis.gp_id} · {qrColis.tracking_num || 'Sans suivi'}
              </p>
              <p style={{ fontSize: 15, color: 'var(--muted)', marginTop: 6 }}>
                Un scan ouvre&nbsp;:{' '}
                <a href={urlSuivi(qrColis.ref)} target="_blank" rel="noreferrer"
                   style={{ color: 'var(--accent)', wordBreak: 'break-all' }}>
                  {urlSuivi(qrColis.ref)}
                </a>
              </p>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }} onClick={downloadQR}>
              Télécharger
            </button>
            <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setQrColis(null)}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════ VUE « MES COLIS » ════════════ */
function ColisView({ colis, onRefresh }) {
  return (
    <>
      <div className={styles.panel} style={{ paddingBottom: 22 }}>
        <div className={styles.panelTitle}>Mes colis</div>
        <div className={styles.panelSub}>
          {colis.length} colis déclaré{colis.length !== 1 ? 's' : ''}
        </div>
      </div>
      <ExpeditionPanel colis={colis} onRefresh={onRefresh}/>
    </>
  );
}

/* ════════════ DÉCLARATION ════════════ */
function DeclareView({ onSuccess, toast }) {
  const [form, setForm] = useState({ fournisseur: '', num_commande: '', tracking_num: '', description: '', poids: '' });
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setPhoto(f);
    setPreview(URL.createObjectURL(f));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.fournisseur) { toast('Choisissez un fournisseur', 'error'); return; }
    if (!form.num_commande.trim()) { toast('Le numéro de commande est obligatoire', 'error'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      if (photo) fd.append('photo', photo);
      await api.post('/colis', fd);
      toast('Colis déclaré avec succès !', 'success');
      onSuccess();
    } catch (err) {
      toast(err.response?.data?.error || 'Erreur lors de la déclaration', 'error');
    } finally { setLoading(false); }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <div>
          <div className={styles.panelTitle}>Déclarer un colis</div>
          <div className={styles.panelSub}>Renseignez les informations de votre commande</div>
        </div>
      </div>

      {/* Consigne centrale du service : sans déclaration, le colis arrive anonyme. */}
      <div className={styles.consigne}>
        <AlertTriangle size={22}/>
        <div>
          <strong>Déclarez chaque commande dès l'achat</strong>
          <p>
            N'attendez pas la livraison. Dès que vous validez une commande chez un
            marchand, déclarez-la ici avec son <strong>numéro de commande</strong>, puis
            complétez le <strong>numéro de colis</strong> dès que le marchand vous l'envoie.
            Sans ces références, nous ne pouvons pas identifier votre colis à son arrivée à Paris.
          </p>
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="form-group">
          <label>Fournisseur *</label>
          <div className={styles.fournisseurGrid}>
            {FOURNISSEURS.map(f => (
              <button
                key={f} type="button"
                className={`${styles.fBtn} ${form.fournisseur === f ? styles.fActive : ''}`}
                onClick={() => set('fournisseur', f)}
              >{f}</button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Numéro de commande *</label>
          <input
            placeholder="Ex : 405-2938471-1029384"
            value={form.num_commande}
            onChange={e => set('num_commande', e.target.value.toUpperCase())}
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
            required
          />
          <p className={styles.champAide}>
            <Receipt size={15}/> Le numéro que le marchand affiche sur votre confirmation d'achat.
          </p>
        </div>

        <div className="form-group">
          <label>Numéro de colis / suivi transporteur</label>
          <input
            placeholder="Ex : 6C21032591304"
            value={form.tracking_num}
            onChange={e => set('tracking_num', e.target.value.toUpperCase())}
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
          />
          <p className={styles.champAide}>
            <Barcode size={15}/> Souvent communiqué après l'expédition — revenez le compléter dès que vous l'avez.
          </p>
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            placeholder="Vêtements, chaussures, électronique…"
            value={form.description}
            onChange={e => set('description', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Poids estimé (kg)</label>
          <input
            type="number" min="0.1" step="0.1" placeholder="2.5"
            value={form.poids} onChange={e => set('poids', e.target.value)}
          />
          {form.poids > 0 && (
            <p style={{ fontSize: 16, color: 'var(--muted)', marginTop: 8 }}>
              Estimation : <strong style={{ color: 'var(--accent)' }}>{(form.poids * 10).toFixed(0)} €</strong>
            </p>
          )}
        </div>

        <div className="form-group">
          <label>Photo du colis (optionnel)</label>
          <div className={styles.uploadZone} onClick={() => fileRef.current.click()}>
            {preview
              ? <img src={preview} alt="Aperçu" className={styles.photoPreview}/>
              : <><Upload size={28}/><p>Cliquez pour ajouter une photo</p></>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile}/>
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
          {loading ? 'Envoi en cours…' : <><Package size={18}/> Déclarer ce colis</>}
        </button>
      </form>
    </div>
  );
}

/* ════════════ PROFIL ════════════ */
function ProfileView({ user, notifs, onLogout }) {
  return (
    <>
      <div className={styles.panel}>
        <div className={styles.profileTop}>
          <div className={styles.avatarLarge}>{(user?.prenom?.[0] || '?').toUpperCase()}</div>
          <div>
            <div className={styles.profileName}>{user?.prenom} {user?.nom}</div>
            <div className={styles.profileMeta}>{user?.gp_id} · {user?.telephone}</div>
          </div>
        </div>

        {[['Email', user?.email], ['Téléphone', user?.telephone], ['Membre depuis', user?.created_at?.slice(0, 10)]]
          .map(([k, v]) => (
            <div key={k} className={styles.infoRow}>
              <span className={styles.infoKey}>{k}</span>
              <span className={styles.infoVal}>{v || '—'}</span>
            </div>
          ))}

        <button className="btn btn-danger" style={{ width: '100%', justifyContent: 'center', marginTop: 26 }} onClick={onLogout}>
          <LogOut size={18}/> Se déconnecter
        </button>
      </div>

      {notifs.length > 0 && (
        <div className={styles.panel}>
          <div className={styles.blockTitle}>Notifications</div>
          {notifs.slice(0, 10).map(n => (
            <div key={n.id} className={styles.notifItem} style={{ opacity: n.read ? .55 : 1 }}>
              <div className={styles.notifDot} style={{ background: n.read ? 'var(--warm-line)' : 'var(--accent)' }}/>
              <div>
                <div className={styles.notifMsg}>{n.message}</div>
                <div className={styles.notifTime}>
                  {n.ref && `${n.ref} · `}{n.created_at?.slice(0, 16).replace('T', ' ')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
