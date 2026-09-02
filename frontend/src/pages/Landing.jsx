import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, MapPin, Phone, Copy, CheckCheck,
  Calculator, ArrowRight, Truck, Users, CheckCircle2,
  MessageCircle, PhoneCall, AlertTriangle, UserPlus
} from 'lucide-react';
import { SUPPORT, waLien } from '../support';
import styles from './Landing.module.css';

const STEPS = [
  { icon: <Users size={24}/>,   label: 'Inscrivez-vous', desc: 'Créez votre compte gratuit et obtenez votre code unique en lettres (ex. GPGHWF) en 30 secondes.' },
  { icon: <MapPin size={24}/>,  label: 'Notre adresse Paris', desc: 'Faites livrer vos commandes à notre dépôt : 14 Bd de la Chapelle, 75018 Paris.' },
  { icon: <Package size={24}/>, label: 'Déclarez dès l\'achat', desc: 'Dès qu\'une commande est validée, déclarez-la avec son numéro de commande, puis le numéro de colis.' },
  { icon: <Truck size={24}/>,   label: 'Suivez & recevez', desc: 'Suivez chaque étape en temps réel et recevez votre colis à Dakar.' },
];

const FOURNISSEURS = ['Shein', 'Amazon', 'Bershka', 'H&M', 'Zara', 'AliExpress', 'Autre'];

// Enseignes du carrousel. `logo` = fichier détouré ; sinon on rend le nom en typo.
// `w`/`h` = dimensions intrinsèques (évitent le décalage au chargement).
// `oh` = hauteur optique de rendu : un logo compact comme H&M doit être plus haut
// qu'un logo allongé comme adidas pour peser pareil à l'œil.
const ENSEIGNES = [
  { nom: 'Amazon',        logo: '/logos/amazon.webp', w: 529, h: 160, oh: 32 },
  { nom: 'eBay',          logo: '/logos/ebay.webp',   w: 397, h: 160, oh: 36 },
  { nom: 'ASOS',          logo: '/logos/asos.webp',   w: 551, h: 160, oh: 31 },
  { nom: 'adidas',        logo: '/logos/adidas.webp', w: 947, h: 160, oh: 24 },
  { nom: 'Shein' },
  { nom: 'H&M',           logo: '/logos/hm.webp',     w: 241, h: 160, oh: 45 },
  { nom: 'Louis Vuitton' },
  { nom: 'Bershka' },
  { nom: 'Zara' },
];

const ADDRESS = {
  'Nom': 'Votre Prénom Nom GPXXXX',
  'Complément': 'Magasin Mr ...',
  'Adresse': '14 Boulevard .......',
  'Code postal': '75018',
  'Ville': 'Paris',
  'Pays': 'France',
  'Tél': '075850....',
};

export default function Landing() {
  const [poids, setPoids] = useState(5);
  const [copied, setCopied] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const total = (Number(poids) || 0) * 10;

  function copyField(key, val) {
    navigator.clipboard.writeText(val).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 1800);
    });
  }

  return (
    <div className={styles.page}>
      {/* ── NAV ── */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <Link to="/" className={styles.logo}>
            <img src="/logo.png" alt="DMgp" />
          </Link>
          <div className={`${styles.navLinks} ${menuOpen ? styles.open : ''}`}>
            <a href="#comment" onClick={() => setMenuOpen(false)}>Comment ça marche</a>
            <a href="#tarifs"  onClick={() => setMenuOpen(false)}>Tarifs</a>
            <a href="#adresse" onClick={() => setMenuOpen(false)}>Adresse</a>
            <a href="#tracking" onClick={() => setMenuOpen(false)}>Suivi</a>
            <a href="#support" onClick={() => setMenuOpen(false)}>Support</a>
            <Link to="/login" className="btn btn-outline btn-sm">Connexion</Link>
            <Link to="/login?mode=register" className="btn btn-primary btn-sm">Créer mon compte</Link>
          </div>
          <button className={styles.burger} onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            <span/><span/><span/>
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroContent}>
            <h1>Vos colis de Paris<br/><span>à Dakar</span></h1>
            <p>
              Commandez sur Shein, Amazon ou H&amp;M avec notre adresse parisienne.
              Nous regroupons et expédions vos colis vers Dakar. 10&nbsp;€/kg, suivi inclus.
            </p>
            {/* Texte de fond : plus petit que l'accroche, pour garder la hiérarchie. */}
            <p className={styles.heroPitch}>
              L'esprit et la flexibilité du GP traditionnel, la précision d'un suivi moderne.
              Pas de frais cachés, pas de démarches compliquées : nous réceptionnons vos
              commandes à Paris et nos voyageurs GP de confiance les acheminent directement
              à Dakar, avec le même soin que si c'était pour notre propre famille.
            </p>
            <div className={styles.heroBtns}>
              <Link to="/login?mode=register" className="btn btn-primary">
                Créer mon compte gratuit <ArrowRight size={18}/>
              </Link>
              <a href="#comment" className={`btn ${styles.heroBtnGhost}`}>
                Comment ça marche
              </a>
            </div>
            <div className={styles.heroStats}>
              <div><strong>10 €</strong><span>par kilo</span></div>
              <div className={styles.statDiv}/>
              <div><strong>Paris</strong><span>→ Dakar</span></div>
              <div className={styles.statDiv}/>
              <div><strong>Suivi</strong><span>en temps réel</span></div>
            </div>
          </div>
        </div>

        <div className={styles.heroMedia}>
          <img src="/hero.webp" alt="Remise d'un colis en main propre"/>
          {/* Aperçu du suivi : montre le produit plutôt que de le décrire */}
          <div className={styles.heroFloat}>
            <div className={styles.floatTop}>
              <span className={styles.floatIcon}><CheckCircle2 size={22}/></span>
              <div>
                <div className={styles.floatRef}>DMG-1042</div>
                <div className={styles.floatMeta}>Shein · 3,2 kg · 32 €</div>
              </div>
            </div>
            <div className={styles.floatSteps}>
              <i data-on="1"/><i data-on="1"/><i data-on="1"/><i data-on="1"/>
            </div>
            <div className={styles.floatStatus}>Livré à Dakar</div>
          </div>
        </div>
      </section>

      {/* ── BANDEAU MARQUES ── */}
      <section className={styles.brands}>
        <p className={styles.brandsLabel}>
          Commandez sur vos sites préférés, livrez à notre adresse parisienne
        </p>
        <div className={styles.marquee}>
          <div className={styles.track}>
            {/* Deux passes identiques : la seconde prend le relais sans rupture. */}
            {[0, 1].map(passe =>
              ENSEIGNES.map(e => (
                <div className={styles.brandItem} key={`${passe}-${e.nom}`} aria-hidden={passe === 1}>
                  {e.logo
                    ? <img
                        src={e.logo} alt={passe === 0 ? e.nom : ''}
                        width={e.w} height={e.h}
                        style={{ '--oh': e.oh }}
                      />
                    : <span className={styles.brandWord}>{e.nom}</span>}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ── COMMENT ── */}
      <section className={styles.section} id="comment">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.tag}>Simple & rapide</span>
            <h2>Comment ça marche ?</h2>
            <p>Quatre étapes, de votre commande en ligne jusqu'à la réception à Dakar.</p>
          </div>
          <div className={styles.steps}>
            {STEPS.map((s, i) => (
              <div key={i} className={styles.step}>
                <span className={styles.stepNum}>Étape {i + 1}</span>
                <div className={styles.stepIcon}>{s.icon}</div>
                <h3>{s.label}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ENTREPÔT ── */}
      <section className={styles.warehouseSection}>
        <div className={styles.warehouseInner}>
          <div className={styles.warehouseText}>
            <span className={styles.tag}>Notre chaîne logistique</span>
            <h2>Vos marques préférées,<br/>notre logistique complète</h2>
            <p>
              Achetez sur Shein, Amazon, H&M ou Bershka — DMgp s'occupe du reste depuis Paris.
              Réception à notre dépôt, regroupement de vos commandes, puis expédition vers Dakar.
            </p>
            <Link to="/login?mode=register" className="btn btn-primary">
              Commencer maintenant <ArrowRight size={18}/>
            </Link>
          </div>
          <div className={styles.warehouseImg}>
            <img src="/entrepot.webp" alt="Entrepôt : réception et regroupement des colis" />
          </div>
        </div>
      </section>

      {/* ── TARIFS ── */}
      <section className={`${styles.section} ${styles.sectionAlt}`} id="tarifs">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.tag}>Transparent</span>
            <h2>Calculez votre tarif</h2>
            <p>Un seul prix, sans surprise : 10 € par kilo, suivi compris.</p>
          </div>
          <div className={styles.calcCard}>
            <div className={styles.calcRow}>
              <label htmlFor="poids">Poids estimé</label>
              <div className={styles.calcControl}>
                <button onClick={() => setPoids(p => Math.max(1, p - 1))} aria-label="Moins">−</button>
                {/* Saisie directe : au-delà de quelques kilos, cliquer devient absurde. */}
                <input
                  id="poids" className={styles.calcInput}
                  type="number" min="1" max="999" inputMode="numeric"
                  value={poids}
                  onChange={e => {
                    const v = parseInt(e.target.value, 10);
                    setPoids(Number.isNaN(v) ? '' : Math.min(999, Math.max(1, v)));
                  }}
                  onBlur={() => { if (poids === '' || poids < 1) setPoids(1); }}
                />
                <span className={styles.calcUnite}>kg</span>
                <button onClick={() => setPoids(p => Math.min(999, (p || 0) + 1))} aria-label="Plus">+</button>
              </div>
            </div>
           
            <div className={styles.calcFournisseurs}>
              {FOURNISSEURS.map(f => <span key={f} className={styles.fTag}>{f}</span>)}
            </div>
            <div className={styles.calcResult}>
              <div>
                <Calculator size={22} className="text-orange"/>
                <span>Total estimé</span>
              </div>
              <strong>{total} €</strong>
            </div>
          </div>
        </div>
      </section>

      {/* ── ADRESSE ── */}
      <section className={styles.section} id="adresse">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.tag}>Notre dépôt Paris</span>
            <h2>Adresse de livraison</h2>
            <p>Renseignez cette adresse au moment de valider vos commandes en ligne.</p>
          </div>
          <div className={styles.addressSplit}>
          <div className={styles.addressVisual}>
            <img src="/colis-etiquette.webp" alt="Colis étiqueté prêt à partir pour Dakar"/>
          </div>
          <div className={styles.addressCard}>
            <div className={styles.addressAlert}>
              <AlertTriangle size={20}/>
              <span>
                <strong>Déclarez chaque commande dès l'achat</strong> depuis votre espace client,
                avec son numéro de commande puis son numéro de colis. Sans cela, nous ne pouvons
                pas identifier votre colis à son arrivée.
              </span>
            </div>
            {Object.entries(ADDRESS).map(([k, v]) => (
              <div key={k} className={styles.addressRow}>
                <div className={styles.addressLabel}>{k}</div>
                <div className={styles.addressValue}>{v}</div>
                <button className={styles.copyBtn} onClick={() => copyField(k, v)} aria-label={`Copier ${k}`}>
                  {copied === k ? <CheckCheck size={16} className="text-orange"/> : <Copy size={16}/>}
                </button>
              </div>
            ))}
            <div className={styles.addressCta}>
              <span className={styles.addressCtaIcon}><UserPlus size={24}/></span>
              <div className={styles.addressCtaTexte}>
                <strong>Il manque votre identifiant</strong>
                <p>
                  Le <code>GPXXXX</code> ci-dessus est un exemple : votre code personnel
                  s'écrit juste après votre nom, en lettres seules — les sites marchands
                  refusent les chiffres dans ce champ. Sans ce code sur le colis, nous ne
                  pouvons pas le rattacher à votre compte à son arrivée à Paris.
                </p>
              </div>
              <Link to="/login?mode=register" className={`btn btn-primary ${styles.addressCtaBtn}`}>
                Créer mon compte gratuit <ArrowRight size={18}/>
              </Link>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* ── SUIVI PUBLIC ── */}
      <section className={`${styles.section} ${styles.sectionAlt}`} id="tracking">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.tag}>Suivi en direct</span>
            <h2>Où est mon colis ?</h2>
            <p>Entrez votre référence DMG pour connaître l'étape en cours.</p>
          </div>
          <TrackPublic />
        </div>
      </section>

      {/* ── SUPPORT ── */}
      <section className={`${styles.section} ${styles.sectionAlt}`} id="support">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.tag}>Une question ?</span>
            <h2>Parlez-nous directement</h2>
            <p>
              Un doute sur une commande, un colis qui tarde, une adresse à vérifier :
              écrivez-nous. Mieux vaut poser la question avant que le colis parte.
            </p>
          </div>
          <div className={styles.supportRow}>
            <a
              className={styles.supportCard}
              href={waLien('Bonjour DMgp, je souhaite des informations sur vos services.')}
              target="_blank" rel="noreferrer"
            >
              <span className={`${styles.supportIcon} ${styles.supportIconWa}`}><MessageCircle size={28}/></span>
              <div>
                <div className={styles.supportTitre}>WhatsApp</div>
                <div className={styles.supportMeta}>{SUPPORT.numero} — réponse rapide</div>
              </div>
            </a>
            <a className={styles.supportCard} href={`tel:${SUPPORT.tel}`}>
              <span className={styles.supportIcon}><PhoneCall size={28}/></span>
              <div>
                <div className={styles.supportTitre}>Nous appeler</div>
                <div className={styles.supportMeta}>{SUPPORT.numero}</div>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className={styles.cta}>
        <div className={styles.ctaInner}>
          <h2>Prêt à envoyer votre premier colis ?</h2>
          <p>Inscription gratuite, ID client instantané, suivi en temps réel.</p>
          <Link to="/login?mode=register" className="btn btn-primary">
            Créer mon compte <ArrowRight size={18}/>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <img src="/logo.png" alt="DMgp"/>
            <span>DMgp Logistique</span>
            <p>14 Bd de la Chapelle, 75018 Paris<br/>Magasin Mr Diop</p>
          </div>
          <div>
            <h4>Liens</h4>
            <a href="#comment">Comment ça marche</a>
            <a href="#tarifs">Tarifs</a>
            <a href="#adresse">Adresse Paris</a>
            <Link to="/login">Espace client</Link>
          </div>
          <div>
            <h4>Contact</h4>
            <a href={waLien('Bonjour DMgp, je souhaite des informations sur vos services.')} target="_blank" rel="noreferrer">
              <MessageCircle size={16}/> WhatsApp {SUPPORT.numero}
            </a>
            <a href={`tel:${SUPPORT.tel}`}><PhoneCall size={16}/> {SUPPORT.numero}</a>
            <a href="tel:0758509931"><Phone size={16}/> Dépôt Paris — 07 58 50 99 31</a>
          </div>
        </div>
        <div className={styles.footerBottom}>
          © {new Date().getFullYear()} DMgp Logistique · Paris → Dakar
        </div>
      </footer>
    </div>
  );
}

const STATUS_INFO = {
  attente:      { label: 'En attente de réception', color: '#7A7B98', icon: '⏳' },
  'recu-paris': { label: 'Reçu à Paris',            color: '#12855A', icon: '✅' },
  transit:      { label: 'En transit vers Dakar',   color: '#B26B00', icon: '🚢' },
  dakar:        { label: 'Arrivé à Dakar',          color: '#3B49B0', icon: '🇸🇳' },
  livre:        { label: 'Livré',                   color: '#5B3FB8', icon: '🏠' },
};

function TrackPublic() {
  const [ref, setRef] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function search(e) {
    e.preventDefault();
    if (!ref.trim()) return;
    setLoading(true); setErr(''); setResult(null);
    try {
      const res = await fetch(`/api/colis/${ref.trim()}`);
      if (!res.ok) throw new Error();
      setResult(await res.json());
    } catch {
      setErr('Colis introuvable. Vérifiez la référence.');
    } finally { setLoading(false); }
  }

  const info = result ? STATUS_INFO[result.status] : null;

  return (
    <div className={styles.trackWrap}>
      <form onSubmit={search} className={styles.trackForm}>
        <input
          className={styles.trackInput}
          placeholder="Ex : DMG-3-001"
          value={ref}
          onChange={e => setRef(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Recherche…' : 'Rechercher'}
        </button>
      </form>

      {err && <p className={styles.trackErr}>{err}</p>}

      {result && (
        <div className={styles.trackResult}>
          <div className={styles.trackEmoji}>{info?.icon || '📦'}</div>
          <h3>{result.ref}</h3>
          <p className={styles.trackMeta}>
            {result.prenom} {result.nom} · {result.fournisseur || 'Colis'}
          </p>
          <div
            className={styles.trackStatus}
            style={{ background: `${info?.color}1A`, color: info?.color }}
          >
            {info?.label}
          </div>
        </div>
      )}
    </div>
  );
}
