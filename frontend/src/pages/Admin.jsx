import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Users, Bell, LogOut,
  Search, Download, RefreshCw, Trash2, QrCode, ChevronDown, Menu, X,
  Plus, Pencil, Upload, Image as ImageIcon, MessageCircle, Copy
} from 'lucide-react';
import QRCode from 'qrcode';
import api from '../api';
import { useToast } from '../components/Toast';
import { urlSuivi, waClient, numeroWhatsApp } from '../support';
import styles from './Admin.module.css';

const NAV = [
  { id: 'dashboard',  icon: <LayoutDashboard size={18}/>, label: 'Vue d\'ensemble' },
  { id: 'colis',      icon: <Package size={18}/>,         label: 'Colis' },
  { id: 'clients',    icon: <Users size={18}/>,           label: 'Clients' },
  { id: 'notifs',     icon: <Bell size={18}/>,            label: 'Notifications' },
];

const STATUS_OPTS = [
  { value: 'attente',     label: '⏳ En attente' },
  { value: 'recu-paris',  label: '✅ Reçu Paris' },
  { value: 'transit',     label: '🚢 En transit' },
  { value: 'dakar',       label: '🇸🇳 À Dakar' },
  { value: 'livre',       label: '🏠 Livré' },
];

const STATUS_STYLE = {
  attente:     { bg: '#f3f4f6', color: '#6b7280' },
  'recu-paris':{ bg: '#dcfce7', color: '#15803d' },
  transit:     { bg: '#fef3c7', color: '#92400e' },
  dakar:       { bg: '#dbeafe', color: '#1d4ed8' },
  livre:       { bg: '#ede9fe', color: '#6d28d9' },
};

const FOURNISSEURS = ['Shein','Amazon','Bershka','H&M','Zara','AliExpress','Shopfrc','Autre'];

/** Tarif unique du service, en euros par kilo. */
const TARIF_KG = 10;

const LIBELLE_STATUT = Object.fromEntries(STATUS_OPTS.map(o => [o.value, o.label]));

/* ── MESSAGES WHATSAPP ──
   Sans emoji : selon le clavier et la version de WhatsApp, ils arrivent
   parfois en losanges noirs chez le destinataire. Une phrase claire passe
   partout. Le message dit où est le colis et renvoie vers l'espace client,
   rien de plus : l'identifiant GP ne sert qu'aux commandes, pas ici. */

/** Où en est le colis, formulé pour tenir après « Votre colis … ». */
const PHRASE_STATUT = {
  attente:      'est bien enregistré, nous l\'attendons à notre dépôt de Paris',
  'recu-paris': 'est arrivé à notre dépôt de Paris',
  transit:      'a quitté Paris, il est en route vers Dakar',
  dakar:        'est arrivé à Dakar',
  livre:        'vous a été livré',
};

/** La même information, en énumération, pour un point sur plusieurs colis. */
const PHRASE_COURTE = {
  attente:      'en attente à Paris',
  'recu-paris': 'arrivé à Paris',
  transit:      'en route vers Dakar',
  dakar:        'arrivé à Dakar',
  livre:        'livré',
};

/** L'espace client, sur le domaine d'où l'admin travaille. */
const lienEspace = () => window.location.origin;

/** Message prêt à envoyer pour un colis précis. */
function messageColis(c) {
  const quoi = c.fournisseur ? `votre colis ${c.fournisseur}` : 'votre colis';
  return [
    `Bonjour ${c.prenom},`,
    '',
    `${quoi.charAt(0).toUpperCase() + quoi.slice(1)} (${c.ref}) ` +
      `${PHRASE_STATUT[c.status] || 'a changé de statut'}.`,
    '',
    `Connectez-vous à votre espace pour voir le détail et la photo : ${lienEspace()}`,
    '',
    'À bientôt,',
    'DMgp Logistique',
  ].join('\n');
}

/** Point complet sur les colis d'un client, quand il y en a plusieurs. */
function messageClient(client, siens) {
  const lignes = [`Bonjour ${client.prenom},`, ''];

  if (!siens.length) {
    lignes.push(
      'Nous n\'avons encore aucun colis enregistré à votre nom.',
      '',
      `Pensez à déclarer chaque commande dès l'achat depuis votre espace : ${lienEspace()}`
    );
  } else {
    // Les colis livrés n'appellent plus rien : on ne les liste que si le
    // client n'a aucun colis en cours.
    const encours = siens.filter(c => c.status !== 'livre');
    const aLister = encours.length ? encours : siens;

    lignes.push(aLister.length > 1 ? 'Voici où en sont vos colis :' : 'Voici où en est votre colis :');
    aLister.forEach(c => lignes.push(
      `- ${c.fournisseur ? `${c.fournisseur} (${c.ref})` : c.ref} : ` +
      `${PHRASE_COURTE[c.status] || c.status}`
    ));
    lignes.push('', `Connectez-vous à votre espace pour le détail et les photos : ${lienEspace()}`);
  }

  lignes.push('', 'À bientôt,', 'DMgp Logistique');
  return lignes.join('\n');
}

export default function Admin() {
  const [view, setView]       = useState('dashboard');
  const [stats, setStats]     = useState({});
  const [colis, setColis]     = useState([]);
  const [clients, setClients] = useState([]);
  const [notifs, setNotifs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [sideOpen, setSideOpen] = useState(false);
  const [qrModal, setQrModal] = useState(null);
  const [qrUrl, setQrUrl]     = useState('');
  const [search, setSearch]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  // Fiche colis en création ou en correction, et photo affichée en grand.
  const [fiche, setFiche]     = useState(null);
  const [photoVue, setPhotoVue] = useState(null);
  const [waMsg, setWaMsg]     = useState(null);
  const toast   = useToast();
  const navigate= useNavigate();

  useEffect(() => { load(); }, [view]);

  async function load() {
    setLoading(true);
    try {
      const [s, c, cl, n] = await Promise.all([
        api.get('/admin/stats'),
        api.get(`/admin/colis?status=${statusFilter}&q=${search}`),
        api.get('/admin/clients'),
        api.get('/notifications'),
      ]);
      setStats(s.data); setColis(c.data); setClients(cl.data); setNotifs(n.data);
    } catch { toast('Erreur chargement', 'error'); }
    finally { setLoading(false); }
  }

  function logout() {
    localStorage.removeItem('dmgp_token');
    localStorage.removeItem('dmgp_user');
    navigate('/login');
  }

  /**
   * Le changement de position est le moment où le client veut être prévenu :
   * le message WhatsApp s'ouvre dans la foulée, déjà écrit.
   */
  async function updateStatus(c, status) {
    try {
      await api.patch(`/admin/colis/${c.id}/status`, { status });
      toast('Statut mis à jour', 'success');
      prevenirColis({ ...c, status });
      load();
    } catch { toast('Erreur', 'error'); }
  }

  function prevenirColis(c) {
    setWaMsg({
      titre: `Prévenir ${c.prenom} ${c.nom}`,
      sousTitre: `${c.ref} · ${LIBELLE_STATUT[c.status] || c.status}`,
      telephone: c.telephone,
      message: messageColis(c),
    });
  }

  function prevenirClient(cl) {
    setWaMsg({
      titre: `Prévenir ${cl.prenom} ${cl.nom}`,
      sousTitre: `${cl.gp_id} · ${cl.nb_colis} colis`,
      telephone: cl.telephone,
      message: messageClient(cl, colis.filter(c => c.client_id === cl.id)),
    });
  }

  /** Le paiement ne se marque qu'une fois le colis remis : le backend le refuse avant. */
  async function togglePaiement(c) {
    try {
      const { data } = await api.patch(`/admin/colis/${c.id}/paiement`, { paye: !c.paye });
      toast(data.colis.paye ? 'Colis marqué payé' : 'Colis marqué non payé', 'success');
      load();
    } catch (e) {
      toast(e.response?.data?.error || 'Erreur', 'error');
    }
  }

  async function deleteColis(id) {
    if (!confirm('Supprimer ce colis ?')) return;
    await api.delete(`/admin/colis/${id}`);
    toast('Supprimé', 'success'); load();
  }

  async function deleteClient(id) {
    if (!confirm('Supprimer ce client et tous ses colis ?')) return;
    await api.delete(`/admin/clients/${id}`);
    toast('Client supprimé', 'success'); load();
  }

  /** Le colis d'un client qui n'a pas déclaré lui-même : on part de son compte. */
  function nouveauColis(clientId = '') {
    setFiche({ client_id: clientId, status: 'attente' });
  }

  /** Les colis d'un seul client : la recherche accepte le code GP. */
  function voirColisClient(gpId) {
    setSearch(gpId);
    setStatusFilter('');
    setView('colis');
  }

  async function openQR(c) {
    // Meme cible que cote client : la fiche de suivi publique.
    const url = await QRCode.toDataURL(urlSuivi(c.ref), {
      width: 260, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#1E193D' },
    });
    setQrUrl(url); setQrModal(c);
  }

  function exportCSV() {
    const rows = [['Ref','Client','GP-ID','Fournisseur','Suivi','Statut','Poids (kg)','Montant (EUR)','Paiement','Date']];
    colis.forEach(c => rows.push([
      c.ref, `${c.prenom} ${c.nom}`, c.gp_id, c.fournisseur||'', c.tracking_num||'', c.status,
      c.poids ?? '', c.poids ? (c.poids * TARIF_KG).toFixed(0) : '',
      c.status === 'livre' ? (c.paye ? 'paye' : 'non paye') : '',
      c.declared_at,
    ]));
    const csv = rows.map(r => r.map(v=>`"${v}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href='data:text/csv;charset=utf-8,﻿'+encodeURIComponent(csv); a.download='dmgp-colis.csv'; a.click();
  }

  const user = JSON.parse(localStorage.getItem('dmgp_user') || '{}');

  return (
    <div className={styles.layout}>
      {/* SIDEBAR */}
      <aside className={`${styles.sidebar} ${sideOpen ? styles.sideOpen : ''}`}>
        <div className={styles.sideTop}>
          <img src="/logo.png" alt="DMgp" className={styles.sideLogo}/>
          <button className={styles.sideClose} onClick={() => setSideOpen(false)}><X size={20}/></button>
        </div>
        <div className={styles.sideUser}>
          <div className={styles.sideAvatar}>A</div>
          <div>
            <div className={styles.sideUserName}>Admin</div>
            <div className={styles.sideUserRole}>Administrateur</div>
          </div>
        </div>
        {NAV.map(n => (
          <button key={n.id} className={`${styles.navItem} ${view===n.id ? styles.navActive : ''}`}
            onClick={() => { setView(n.id); setSideOpen(false); }}>
            {n.icon} {n.label}
          </button>
        ))}
        <div style={{marginTop:'auto'}}>
          <button className={styles.navItem} onClick={logout}><LogOut size={18}/> Déconnexion</button>
        </div>
      </aside>
      {sideOpen && <div className={styles.overlay} onClick={() => setSideOpen(false)}/>}

      {/* MAIN */}
      <div className={styles.main}>
        {/* TOPBAR */}
        <div className={styles.topbar}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <button className={styles.menuBtn} onClick={() => setSideOpen(true)}><Menu size={20}/></button>
            <h1 className={styles.pageTitle}>{NAV.find(n=>n.id===view)?.label}</h1>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={15}/> Actualiser</button>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className="loader"><div className="spinner"/></div>
          ) : (
            <>
              {view === 'dashboard' && <ViewDashboard stats={stats} colis={colis} updateStatus={updateStatus} openQR={openQR}/>}
              {view === 'colis'     && <ViewColis colis={colis} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} load={load} updateStatus={updateStatus} deleteColis={deleteColis} openQR={openQR} exportCSV={exportCSV} onNouveau={() => nouveauColis()} onEditer={setFiche} onPhoto={setPhotoVue} onPrevenir={prevenirColis} onPaiement={togglePaiement}/>}
              {view === 'clients'   && <ViewClients clients={clients} colis={colis} deleteClient={deleteClient} onNouveauColis={nouveauColis} onVoirColis={voirColisClient} onPrevenir={prevenirClient}/>}
              {view === 'notifs'    && <ViewNotifs notifs={notifs}/>}
            </>
          )}
        </div>
      </div>

      {/* FICHE COLIS (création / correction) */}
      {fiche && (
        <FicheColis
          initial={fiche}
          clients={clients}
          toast={toast}
          onClose={() => setFiche(null)}
          onSaved={() => { setFiche(null); load(); }}
        />
      )}

      {/* MESSAGE WHATSAPP */}
      {waMsg && (
        <ModaleWhatsApp initial={waMsg} toast={toast} onClose={() => setWaMsg(null)}/>
      )}

      {/* PHOTO EN GRAND */}
      {photoVue && (
        <div className="modal-overlay" onClick={() => setPhotoVue(null)}>
          <img src={photoVue} alt="Photo du colis" onClick={e => e.stopPropagation()}
               style={{maxWidth:'90vw',maxHeight:'85vh',borderRadius:12,background:'#fff'}}/>
        </div>
      )}

      {/* QR MODAL */}
      {qrModal && (
        <div className="modal-overlay" onClick={() => setQrModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>QR Code – {qrModal.ref}</h3>
            <div style={{textAlign:'center',margin:'20px 0'}}>
              <img src={qrUrl} alt="QR" style={{borderRadius:12,border:'1px solid var(--border)'}}/>
              <p style={{fontSize:15,color:'var(--text-light)',marginTop:10}}>{qrModal.fournisseur} · {qrModal.gp_id}</p>
            </div>
            <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',marginBottom:10}}
              onClick={() => { const a=document.createElement('a');a.href=qrUrl;a.download=`dmgp-${qrModal.ref}.png`;a.click(); }}>
              ⬇ Télécharger
            </button>
            <button className="btn btn-ghost" style={{width:'100%',justifyContent:'center'}} onClick={() => setQrModal(null)}>Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Bascule payé / non payé.
 *
 * Tant que le colis n'est pas remis, il n'y a rien à encaisser et le poids
 * final n'est pas connu : la case reste inerte, et le backend refuserait
 * de toute façon la bascule.
 */
function Paiement({ colis, onBasculer }) {
  if (colis.status !== 'livre') {
    return (
      <span style={{fontSize:14,color:'var(--text-light)'}} title="Possible une fois le colis livré">
        —
      </span>
    );
  }
  const paye = Boolean(colis.paye);
  return (
    <button
      onClick={() => onBasculer(colis)}
      title={paye ? 'Marquer comme non payé' : 'Marquer comme payé'}
      style={{
        border:'none', borderRadius:20, padding:'5px 12px', cursor:'pointer',
        fontSize:15, fontWeight:600, fontFamily:'inherit',
        background: paye ? '#dcfce7' : '#fee2e2',
        color:      paye ? '#15803d' : '#b91c1c',
      }}
    >
      {paye ? 'Payé' : 'Non payé'}
    </button>
  );
}

/**
 * Vignette de la photo d'un colis.
 *
 * Les colis declares avant Cloudinary pointent sur `/uploads/…`, un disque
 * efface a chaque redeploiement : la photo n'existe plus. On retombe alors
 * sur l'icone, jamais sur une image cassee — et l'absence de vignette
 * signale a l'equipe qu'il faut en reprendre une.
 */
function Vignette({ colis, onOuvrir }) {
  const [chargeable, setChargeable] = useState(Boolean(colis.photo));

  if (!chargeable) {
    return <div className={styles.vignetteVide}><ImageIcon size={16}/></div>;
  }
  return (
    <img src={colis.photo} alt="" className={styles.vignette}
         title="Voir la photo"
         onClick={() => onOuvrir(colis.photo)}
         onError={() => setChargeable(false)}/>
  );
}

/* ── MESSAGE WHATSAPP ──
   Pas d'envoi automatique : WhatsApp s'ouvre avec le message déjà écrit,
   relu et modifiable, et c'est l'équipe qui appuie sur envoyer. Aucun
   compte WhatsApp Business ni abonnement n'est nécessaire. */
function ModaleWhatsApp({ initial, toast, onClose }) {
  const [telephone, setTelephone] = useState(initial.telephone || '');
  const [message, setMessage]     = useState(initial.message);

  const numero = numeroWhatsApp(telephone);
  const valide = numero.length >= 8;

  async function copier() {
    try {
      await navigator.clipboard.writeText(message);
      toast('Message copié', 'success');
    } catch { toast('Copie impossible', 'error'); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{maxWidth:520}}>
        <h3 style={{marginBottom:6}}>{initial.titre}</h3>
        {initial.sousTitre && (
          <p style={{fontSize:15,color:'var(--text-light)',marginBottom:20}}>{initial.sousTitre}</p>
        )}

        <div className="form-group">
          <label>Numéro WhatsApp</label>
          <input value={telephone} onChange={e => setTelephone(e.target.value)}
                 placeholder="+221 77 000 00 00"/>
          <div style={{fontSize:14,color: valide ? 'var(--text-light)' : 'var(--red)',marginTop:6}}>
            {valide
              ? `Sera ouvert avec le +${numero}`
              : 'Numéro incomplet : ajoutez l\'indicatif du pays.'}
          </div>
        </div>

        <div className="form-group">
          <label>Message</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)}
                    style={{minHeight:190,fontSize:15,lineHeight:1.6}}/>
        </div>

        <a className="btn btn-success"
           style={{width:'100%',justifyContent:'center',marginBottom:10,
                   textDecoration:'none', pointerEvents: valide ? 'auto' : 'none',
                   opacity: valide ? 1 : .55}}
           href={valide ? waClient(telephone, message) : undefined}
           target="_blank" rel="noreferrer" onClick={onClose}>
          <MessageCircle size={16}/> Ouvrir WhatsApp
        </a>
        <div style={{display:'flex',gap:10}}>
          <button className="btn btn-ghost" style={{flex:1,justifyContent:'center'}} onClick={copier}>
            <Copy size={15}/> Copier
          </button>
          <button className="btn btn-ghost" style={{flex:1,justifyContent:'center'}} onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── FICHE COLIS ──
   Même formulaire pour créer un colis au nom d'un client et pour corriger
   une fiche existante : les deux manipulent exactement les mêmes champs. */
function FicheColis({ initial, clients, toast, onClose, onSaved }) {
  const edition = Boolean(initial.id);
  const [form, setForm] = useState({
    client_id:    String(initial.client_id || ''),
    fournisseur:  initial.fournisseur  || '',
    num_commande: initial.num_commande || '',
    tracking_num: initial.tracking_num || '',
    description:  initial.description  || '',
    poids:        initial.poids ?? '',
    status:       initial.status || 'attente',
  });
  const [photo, setPhoto]     = useState(null);
  const [apercu, setApercu]   = useState(initial.photo || '');
  const [saving, setSaving]   = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function choisirPhoto(e) {
    const f = e.target.files[0];
    if (!f) return;
    setPhoto(f);
    setApercu(URL.createObjectURL(f));
  }

  async function submit(e) {
    e.preventDefault();
    if (!edition && !form.client_id) { toast('Choisissez un client', 'error'); return; }
    if (!form.num_commande.trim())   { toast('Le numéro de commande est obligatoire', 'error'); return; }

    setSaving(true);
    try {
      const fd = new FormData();
      if (!edition) fd.append('client_id', form.client_id);
      // Tous les champs partent, même vides : un champ effacé doit l'être en base.
      ['fournisseur','num_commande','tracking_num','description','poids','status']
        .forEach(k => fd.append(k, form[k] ?? ''));
      if (photo) fd.append('photo', photo);

      if (edition) await api.patch(`/admin/colis/${initial.id}`, fd);
      else         await api.post('/admin/colis', fd);

      toast(edition ? 'Fiche mise à jour' : 'Colis ajouté au compte du client', 'success');
      onSaved();
    } catch (err) {
      toast(err.response?.data?.error || 'Erreur lors de l\'enregistrement', 'error');
    } finally { setSaving(false); }
  }

  const client = clients.find(c => String(c.id) === form.client_id);

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{maxWidth:560,maxHeight:'90vh',overflowY:'auto'}}>
        <h3>{edition ? `Colis ${initial.ref}` : 'Nouveau colis'}</h3>

        <form onSubmit={submit}>
          <div className="form-group">
            <label>Client *</label>
            {edition ? (
              <input value={`${initial.prenom || ''} ${initial.nom || ''} — ${initial.gp_id || ''}`} disabled/>
            ) : (
              <select value={form.client_id} onChange={e => set('client_id', e.target.value)}>
                <option value="">— Choisir un client —</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.prenom} {c.nom} — {c.gp_id} ({c.nb_colis} colis)
                  </option>
                ))}
              </select>
            )}
            {!edition && client && (
              <div style={{fontSize:14,color:'var(--text-light)',marginTop:6}}>
                {client.telephone}{client.email ? ` · ${client.email}` : ''}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Fournisseur</label>
            <input list="dmgp-fournisseurs" value={form.fournisseur}
                   placeholder="Shein, Amazon…"
                   onChange={e => set('fournisseur', e.target.value)}/>
            <datalist id="dmgp-fournisseurs">
              {FOURNISSEURS.map(f => <option key={f} value={f}/>)}
            </datalist>
          </div>

          <div className="form-group">
            <label>N° de commande *</label>
            <input value={form.num_commande} placeholder="Numéro donné par le marchand"
                   onChange={e => set('num_commande', e.target.value)}/>
          </div>

          <div className="form-group">
            <label>N° de suivi (tracking)</label>
            <input value={form.tracking_num} placeholder="Numéro du transporteur"
                   onChange={e => set('tracking_num', e.target.value)}/>
          </div>

          <div className="form-group">
            <label>Position actuelle</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div style={{fontSize:14,color:'var(--text-light)',marginTop:6}}>
              Le client reçoit une notification à chaque changement.
            </div>
          </div>

          <div className="form-group">
            <label>Poids (kg)</label>
            <input type="number" min="0" step="0.1" value={form.poids}
                   onChange={e => set('poids', e.target.value)}/>
            {form.poids > 0 && (
              <div style={{fontSize:14,color:'var(--text-light)',marginTop:6}}>
                Estimation : <strong>{(form.poids * 10).toFixed(0)} €</strong>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea value={form.description} placeholder="Contenu, état du carton…"
                      onChange={e => set('description', e.target.value)}/>
          </div>

          <div className="form-group">
            <label>Photo du colis</label>
            <label style={{
              display:'flex',flexDirection:'column',alignItems:'center',gap:10,
              padding:apercu ? 12 : 26, border:'1.5px dashed var(--line)',
              borderRadius:12, cursor:'pointer', color:'var(--text-light)'
            }}>
              {apercu
                ? <img src={apercu} alt="Aperçu" style={{maxHeight:180,borderRadius:8,objectFit:'cover'}}/>
                : <><Upload size={26}/><span>Cliquez pour ajouter une photo</span></>}
              <input type="file" accept="image/*" onChange={choisirPhoto} style={{display:'none'}}/>
              {apercu && <span style={{fontSize:14}}>Cliquez pour remplacer</span>}
            </label>
          </div>

          <div style={{display:'flex',gap:10}}>
            <button type="button" className="btn btn-ghost" style={{flex:1,justifyContent:'center'}}
                    onClick={onClose} disabled={saving}>Annuler</button>
            <button type="submit" className="btn btn-primary" style={{flex:1,justifyContent:'center'}}
                    disabled={saving}>
              {saving ? 'Enregistrement…' : (edition ? 'Enregistrer' : 'Ajouter le colis')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── DASHBOARD VIEW ── */
function ViewDashboard({ stats, colis, updateStatus, openQR }) {
  const kpis = [
    { label:'Clients',    value: stats.clients, color:'var(--blue)' },
    { label:'Colis total',value: stats.total,   color:'var(--blue)' },
    { label:'En attente', value: stats.attente,  color:'var(--yellow)' },
    { label:'Reçus Paris',value: stats.recu,     color:'var(--green)' },
    { label:'En transit', value: stats.transit,  color:'#d97706' },
    { label:'Livrés',     value: stats.livre,    color:'#6d28d9' },
  ];
  const attendus = colis.filter(c => c.status === 'attente' && c.tracking_num);

  return (
    <div>
      <div className={styles.kpiGrid}>
        {kpis.map(k => (
          <div key={k.label} className={styles.kpiCard}>
            <div className={styles.kpiVal} style={{color:k.color}}>{k.value ?? 0}</div>
            <div className={styles.kpiLabel}>{k.label}</div>
          </div>
        ))}
      </div>
      <h3 className={styles.secTitle}>📦 Colis attendus avec numéro de suivi</h3>
      {attendus.length === 0
        ? <p style={{color:'var(--text-light)',fontSize:16,padding:'20px 0'}}>Aucun colis en attente avec numéro de suivi</p>
        : <div className="tbl-wrap"><table>
            <thead><tr><th>Client</th><th>Fournisseur</th><th>N° Suivi</th><th>Actions</th></tr></thead>
            <tbody>
              {attendus.map(c => (
                <tr key={c.id}>
                  <td><strong style={{color:'var(--blue)'}}>{c.prenom} {c.nom}</strong><br/><span style={{fontSize:16,color:'var(--text-light)'}}>{c.gp_id}</span></td>
                  <td>{c.fournisseur||'—'}</td>
                  <td style={{fontFamily:'monospace',fontSize:15}}>{c.tracking_num}</td>
                  <td style={{display:'flex',gap:8}}>
                    <button className="btn btn-success btn-sm" onClick={() => updateStatus(c,'recu-paris')}>✅ Réceptionner</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => openQR(c)}><QrCode size={14}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
      }
    </div>
  );
}

/* ── COLIS VIEW ── */
function ViewColis({ colis, search, setSearch, statusFilter, setStatusFilter, load, updateStatus, deleteColis, openQR, exportCSV, onNouveau, onEditer, onPhoto, onPrevenir, onPaiement }) {
  const filtered = colis.filter(c => {
    const q = search.toLowerCase();
    return (!q || (`${c.prenom} ${c.nom} ${c.ref} ${c.tracking_num||''} ${c.gp_id}`).toLowerCase().includes(q))
      && (!statusFilter || c.status === statusFilter);
  });

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon}/>
          <input className={styles.searchInput} placeholder="Rechercher…" value={search} onChange={e => { setSearch(e.target.value); }}/>
        </div>
        <select className={styles.select} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Tous les statuts</option>
          {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={onNouveau}><Plus size={14}/> Nouveau colis</button>
        <button className="btn btn-ghost btn-sm" onClick={exportCSV}><Download size={14}/> Export CSV</button>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Photo</th><th>Réf</th><th>Client</th><th>Fournisseur</th><th>N° Suivi</th><th>Statut</th><th>Paiement</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={9} style={{textAlign:'center',padding:40,color:'var(--text-light)'}}>Aucun colis trouvé</td></tr>
              : filtered.map(c => {
                  const ss = STATUS_STYLE[c.status] || STATUS_STYLE.attente;
                  return (
                    <tr key={c.id}>
                      <td><Vignette colis={c} onOuvrir={onPhoto}/></td>
                      <td style={{fontFamily:'monospace',fontSize:16,color:'var(--text-light)'}}>{c.ref}</td>
                      <td><strong style={{color:'var(--blue)'}}>{c.prenom} {c.nom}</strong><br/><span style={{fontSize:16,color:'var(--text-light)'}}>{c.gp_id}</span></td>
                      <td>{c.fournisseur||'—'}</td>
                      <td style={{fontFamily:'monospace',fontSize:15}}>{c.tracking_num||'—'}</td>
                      <td>
                        <select
                          value={c.status}
                          onChange={e => updateStatus(c, e.target.value)}
                          style={{
                            border:'none', borderRadius:20, padding:'5px 10px',
                            fontSize:15, fontWeight:600, cursor:'pointer',
                            background: ss.bg, color: ss.color, fontFamily:'inherit'
                          }}
                        >
                          {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td><Paiement colis={c} onBasculer={onPaiement}/></td>
                      <td style={{fontSize:15,color:'var(--text-light)'}}>{c.declared_at?.slice(0,10)}</td>
                      <td>
                        <div style={{display:'flex',gap:6}}>
                          <button className="btn btn-success btn-sm" title="Prévenir le client sur WhatsApp" onClick={() => onPrevenir(c)}><MessageCircle size={13}/></button>
                          <button className="btn btn-ghost btn-sm" title="Modifier / photo" onClick={() => onEditer(c)}><Pencil size={13}/></button>
                          <button className="btn btn-ghost btn-sm" title="QR code" onClick={() => openQR(c)}><QrCode size={13}/></button>
                          <button className="btn btn-danger btn-sm" title="Supprimer" onClick={() => deleteColis(c.id)}><Trash2 size={13}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── CLIENTS VIEW ── */
function ViewClients({ clients, colis, deleteClient, onNouveauColis, onVoirColis, onPrevenir }) {
  const [search, setSearch] = useState('');
  const filtered = clients.filter(c =>
    // L'ancien code chiffré reste cherchable : les colis étiquetés avant
    // le passage aux codes lettrés ne portent que celui-là.
    !search || (`${c.prenom} ${c.nom} ${c.gp_id} ${c.ancien_gp_id || ''} ${c.telephone}`)
      .toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon}/>
          <input className={styles.searchInput} placeholder="Rechercher un client…" value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <span style={{fontSize:15,color:'var(--text-light)',alignSelf:'center'}}>{filtered.length} client{filtered.length>1?'s':''}</span>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>ID</th><th>Nom</th><th>Téléphone</th><th>Email</th><th>Inscription</th><th>Colis</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={7} style={{textAlign:'center',padding:40,color:'var(--text-light)'}}>Aucun client</td></tr>
              : filtered.map(c => (
                  <tr key={c.id}>
                    <td>
                      <strong style={{color:'var(--orange)',fontFamily:'monospace'}}>{c.gp_id}</strong>
                      {c.ancien_gp_id && (
                        <div style={{fontSize:13,color:'var(--text-light)',fontFamily:'monospace'}}>
                          ex-{c.ancien_gp_id}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:34,height:34,borderRadius:'50%',background:'var(--ink)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:600,fontSize:15,flexShrink:0}}>
                          {(c.prenom?.[0]||'?').toUpperCase()}
                        </div>
                        <div>
                          <div style={{fontWeight:600}}>{c.prenom} {c.nom}</div>
                          <div style={{fontSize:16,color:'var(--text-light)'}}>{c.prenom} {c.nom} – {c.gp_id}</div>
                        </div>
                      </div>
                    </td>
                    <td>{c.telephone}</td>
                    <td style={{fontSize:15,color:'var(--text-light)'}}>{c.email||'—'}</td>
                    <td style={{fontSize:15,color:'var(--text-light)'}}>{c.created_at?.slice(0,10)}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" title="Voir ses colis"
                              onClick={() => onVoirColis(c.gp_id)}>
                        <Package size={13}/> {c.nb_colis}
                      </button>
                    </td>
                    <td>
                      <div style={{display:'flex',gap:6}}>
                        <button className="btn btn-primary btn-sm" title="Déclarer un colis pour ce client"
                                onClick={() => onNouveauColis(c.id)}>
                          <Plus size={13}/> Colis
                        </button>
                        <button className="btn btn-success btn-sm" title="Prévenir sur WhatsApp"
                                onClick={() => onPrevenir(c)}>
                          <MessageCircle size={13}/>
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteClient(c.id)}><Trash2 size={13}/></button>
                      </div>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── NOTIFS VIEW ── */
function ViewNotifs({ notifs }) {
  return (
    <div>
      {notifs.length === 0
        ? <div style={{textAlign:'center',padding:60,color:'var(--text-light)'}}>Aucune notification</div>
        : notifs.map(n => (
            <div key={n.id} className={styles.notifItem}>
              <div className={styles.notifDot} style={{background: n.read ? 'var(--border)' : 'var(--orange)'}}/>
              <div>
                <div style={{fontWeight:600,fontSize:14}}>{n.message}</div>
                <div style={{fontSize:15,color:'var(--text-light)',marginTop:3}}>{n.created_at?.slice(0,16).replace('T',' ')}</div>
              </div>
            </div>
          ))
      }
    </div>
  );
}
