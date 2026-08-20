import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Users, Bell, LogOut,
  Search, Download, RefreshCw, Trash2, QrCode, ChevronDown, Menu, X
} from 'lucide-react';
import QRCode from 'qrcode';
import api from '../api';
import { useToast } from '../components/Toast';
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

  async function updateStatus(id, status) {
    try {
      await api.patch(`/admin/colis/${id}/status`, { status });
      toast('Statut mis à jour', 'success');
      load();
    } catch { toast('Erreur', 'error'); }
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

  async function openQR(c) {
    const data = `DMGP|${c.ref}|${c.gp_id}|${c.fournisseur||'?'}|${c.tracking_num||'?'}`;
    const url = await QRCode.toDataURL(data, { width: 200, margin:2, color: { dark:'#1B3A6B' } });
    setQrUrl(url); setQrModal(c);
  }

  function exportCSV() {
    const rows = [['Ref','Client','GP-ID','Fournisseur','Suivi','Statut','Date']];
    colis.forEach(c => rows.push([c.ref, `${c.prenom} ${c.nom}`, c.gp_id, c.fournisseur||'', c.tracking_num||'', c.status, c.declared_at]));
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
              {view === 'colis'     && <ViewColis colis={colis} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} load={load} updateStatus={updateStatus} deleteColis={deleteColis} openQR={openQR} exportCSV={exportCSV}/>}
              {view === 'clients'   && <ViewClients clients={clients} colis={colis} deleteClient={deleteClient}/>}
              {view === 'notifs'    && <ViewNotifs notifs={notifs}/>}
            </>
          )}
        </div>
      </div>

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
                    <button className="btn btn-success btn-sm" onClick={() => updateStatus(c.id,'recu-paris')}>✅ Réceptionner</button>
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
function ViewColis({ colis, search, setSearch, statusFilter, setStatusFilter, load, updateStatus, deleteColis, openQR, exportCSV }) {
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
        <button className="btn btn-primary btn-sm" onClick={exportCSV}><Download size={14}/> Export CSV</button>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Réf</th><th>Client</th><th>Fournisseur</th><th>N° Suivi</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={7} style={{textAlign:'center',padding:40,color:'var(--text-light)'}}>Aucun colis trouvé</td></tr>
              : filtered.map(c => {
                  const ss = STATUS_STYLE[c.status] || STATUS_STYLE.attente;
                  return (
                    <tr key={c.id}>
                      <td style={{fontFamily:'monospace',fontSize:16,color:'var(--text-light)'}}>{c.ref}</td>
                      <td><strong style={{color:'var(--blue)'}}>{c.prenom} {c.nom}</strong><br/><span style={{fontSize:16,color:'var(--text-light)'}}>{c.gp_id}</span></td>
                      <td>{c.fournisseur||'—'}</td>
                      <td style={{fontFamily:'monospace',fontSize:15}}>{c.tracking_num||'—'}</td>
                      <td>
                        <select
                          value={c.status}
                          onChange={e => updateStatus(c.id, e.target.value)}
                          style={{
                            border:'none', borderRadius:20, padding:'5px 10px',
                            fontSize:15, fontWeight:600, cursor:'pointer',
                            background: ss.bg, color: ss.color, fontFamily:'inherit'
                          }}
                        >
                          {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td style={{fontSize:15,color:'var(--text-light)'}}>{c.declared_at?.slice(0,10)}</td>
                      <td>
                        <div style={{display:'flex',gap:6}}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openQR(c)}><QrCode size={13}/></button>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteColis(c.id)}><Trash2 size={13}/></button>
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
function ViewClients({ clients, colis, deleteClient }) {
  const [search, setSearch] = useState('');
  const filtered = clients.filter(c =>
    !search || (`${c.prenom} ${c.nom} ${c.gp_id} ${c.telephone}`).toLowerCase().includes(search.toLowerCase())
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
                    <td><strong style={{color:'var(--orange)',fontFamily:'monospace'}}>{c.gp_id}</strong></td>
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
                    <td><strong>{c.nb_colis}</strong></td>
                    <td>
                      <div style={{display:'flex',gap:6}}>
                        <a href={`https://wa.me/${c.telephone?.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                          className="btn btn-success btn-sm" style={{textDecoration:'none'}}>💬</a>
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
