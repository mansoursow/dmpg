import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Clock, CheckCircle2, Truck, Globe, Home, Package,
  MessageCircle, ArrowLeft, Search
} from 'lucide-react';
import { SUPPORT, waLien } from '../support';
import styles from './Suivi.module.css';

/* Les étapes dans l'ordre du parcours, avec la date qui les horodate. */
const ETAPES = [
  { id: 'attente',    label: 'Déclaré',        date: 'declared_at',  icone: <Clock size={20}/> },
  { id: 'recu-paris', label: 'Reçu à Paris',   date: 'received_at',  icone: <CheckCircle2 size={20}/> },
  { id: 'transit',    label: 'En transit',     date: 'shipped_at',   icone: <Truck size={20}/> },
  { id: 'dakar',      label: 'Arrivé à Dakar', date: null,           icone: <Globe size={20}/> },
  { id: 'livre',      label: 'Livré',          date: 'delivered_at', icone: <Home size={20}/> },
];

const COULEURS = {
  attente:      '#7A7B98',
  'recu-paris': '#12855A',
  transit:      '#B26B00',
  dakar:        '#3B49B0',
  livre:        '#5B3FB8',
};

function formaterDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function Suivi() {
  const { ref } = useParams();
  const [colis, setColis] = useState(null);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const r = await fetch(`/api/colis/${encodeURIComponent(ref)}`);
        if (!r.ok) throw new Error(r.status === 404 ? 'introuvable' : 'erreur');
        const d = await r.json();
        if (!annule) setColis(d);
      } catch (e) {
        if (!annule) setErreur(e.message === 'introuvable'
          ? `Aucun colis ne porte la référence ${ref}.`
          : 'Le service de suivi est momentanément indisponible.');
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => { annule = true; };
  }, [ref]);

  const indexActuel = colis ? ETAPES.findIndex(e => e.id === colis.status) : -1;

  return (
    <div className={styles.page}>
      <header className={styles.entete}>
        <Link to="/" className={styles.retour}>
          <ArrowLeft size={18}/> Retour au site
        </Link>
        <Link to="/"><img src="/logo.png" alt="DMgp" className={styles.logo}/></Link>
      </header>

      <main className={styles.contenu}>
        {chargement && (
          <div className={styles.carte}>
            <div className="loader"><div className="spinner"/><span>Recherche du colis…</span></div>
          </div>
        )}

        {!chargement && erreur && (
          <div className={styles.carte}>
            <div className={styles.vide}>
              <Search size={40}/>
              <h1>Colis introuvable</h1>
              <p>{erreur}</p>
              <p className={styles.videAide}>
                Vérifiez la référence — elle commence par <code>DMG-</code> et
                figure dans votre espace client.
              </p>
              <Link to="/" className="btn btn-primary">Retour à l'accueil</Link>
            </div>
          </div>
        )}

        {!chargement && colis && (
          <>
            <div className={styles.carte}>
              <div className={styles.enTete}>
                <div>
                  <div className={styles.refLabel}>Référence</div>
                  <h1 className={styles.ref}>{colis.ref}</h1>
                </div>
                <span
                  className={styles.pastille}
                  style={{ background: `${COULEURS[colis.status]}1A`, color: COULEURS[colis.status] }}
                >
                  {ETAPES.find(e => e.id === colis.status)?.label || colis.status}
                </span>
              </div>

              <div className={styles.meta}>
                <div><span>Destinataire</span><strong>{colis.prenom} {colis.nom}</strong></div>
                <div><span>Identifiant</span><strong className={styles.mono}>{colis.gp_id}</strong></div>
                {colis.fournisseur && <div><span>Fournisseur</span><strong>{colis.fournisseur}</strong></div>}
                {colis.poids != null && (
                  <div><span>Poids</span><strong>{colis.poids} kg — {(colis.poids * 10).toFixed(0)} €</strong></div>
                )}
                {colis.tracking_num && (
                  <div><span>Suivi transporteur</span><strong className={styles.mono}>{colis.tracking_num}</strong></div>
                )}
              </div>
            </div>

            <div className={styles.carte}>
              <h2 className={styles.titreBloc}>Parcours du colis</h2>
              <ol className={styles.parcours}>
                {ETAPES.map((etape, i) => {
                  const faite   = i <= indexActuel;
                  const courante = i === indexActuel;
                  const quand   = etape.date ? formaterDate(colis[etape.date]) : null;
                  return (
                    <li
                      key={etape.id}
                      className={`${styles.etape} ${faite ? styles.etapeFaite : ''} ${courante ? styles.etapeCourante : ''}`}
                    >
                      <span className={styles.etapePuce}>{etape.icone}</span>
                      <div className={styles.etapeTexte}>
                        <strong>{etape.label}</strong>
                        {quand && faite && <span className={styles.etapeDate}>{quand}</span>}
                        {courante && !quand && <span className={styles.etapeDate}>Étape en cours</span>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            <a
              className={styles.aide}
              href={waLien(`Bonjour DMgp, une question sur le colis ${colis.ref}.`)}
              target="_blank" rel="noreferrer"
            >
              <span className={styles.aideIcone}><MessageCircle size={22}/></span>
              <div>
                <strong>Une question sur ce colis ?</strong>
                <span>Écrivez-nous sur WhatsApp — {SUPPORT.numero}</span>
              </div>
            </a>
          </>
        )}

        <p className={styles.pied}>
          <Package size={16}/> DMgp Logistique · Paris → Dakar
        </p>
      </main>
    </div>
  );
}
