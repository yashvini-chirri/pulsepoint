import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, ArrowRight, BarChart3, CreditCard, Dumbbell, HeartPulse, LayoutDashboard, Link2, Menu, Plus, Search, ShieldCheck, UserRound, Users, X } from 'lucide-react';
import './styles.css';

const API = import.meta.env.VITE_API_URL || '/api';
const sections = [
  ['dashboard', 'Dashboard', LayoutDashboard], ['members', 'Members', Users], ['plans', 'Membership Plans', ShieldCheck],
  ['trainers', 'Trainers', UserRound], ['sessions', 'Workout Sessions', Dumbbell], ['attendance', 'Attendance', Activity],
  ['payments', 'Payments', CreditCard], ['relationships', 'Relationships', Link2]
];
const labels = { members: 'Member', plans: 'MembershipPlan', trainers: 'Trainer', sessions: 'WorkoutSession', payments: 'Payment' };
const relationTypes = [
  ['HAS_PLAN', 'Member', 'Plan'], ['CONDUCTS', 'Trainer', 'Workout session'],
  ['ATTENDS', 'Member', 'Workout session'], ['MADE_PAYMENT', 'Member', 'Payment']
];
const optionResources = ['members', 'plans', 'trainers', 'sessions', 'payments'];
const pretty = (key) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json', ...options.headers }, ...options });
  const rawBody = response.status === 204 ? '' : await response.text();
  let body = null;
  if (rawBody) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = { error: `Server returned HTTP ${response.status} instead of JSON.` };
    }
  }
  if (!response.ok) throw new Error(body?.error || 'Request failed');
  return body;
}

class AppErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Fitness Club UI render error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <main className="main error-page"><div className="panel"><p className="eyebrow">APPLICATION ERROR</p><h1>The dashboard could not render</h1><p className="muted">{this.state.error.message}</p><button className="primary-button" onClick={() => window.location.reload()}>Reload dashboard</button></div></main>;
  }
}

function App() {
  const [section, setSection] = useState('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [health, setHealth] = useState({ database: 'checking' });
  useEffect(() => { api('/health').then(setHealth).catch((error) => setHealth({ database: 'disconnected', error: error.message })); }, []);
  const current = sections.find(([id]) => id === section);
  return <div className="app-shell">
    <aside className={mobileOpen ? 'sidebar open' : 'sidebar'}>
      <div className="brand"><div className="brand-mark"><HeartPulse size={21} /></div><div><strong>PulsePoint</strong><small>Fitness Club OS</small></div><button className="close-menu" onClick={() => setMobileOpen(false)}><X size={20} /></button></div>
      <nav>{sections.map(([id, label, Icon]) => <button className={section === id ? 'nav-item active' : 'nav-item'} key={id} onClick={() => { setSection(id); setMobileOpen(false); }}><Icon size={18} />{label}</button>)}</nav>
      <div className="sidebar-footer"><span className={health.database === 'connected' ? 'status-dot' : 'status-dot offline'} />{health.database === 'connected' ? 'Neo4j connected' : health.database === 'checking' ? 'Checking database...' : 'Database offline'}</div>
    </aside>
    {mobileOpen && <div className="backdrop" onClick={() => setMobileOpen(false)} />}
    <main className="main"><header><button className="menu-button" onClick={() => setMobileOpen(true)}><Menu /></button><div><p className="eyebrow">FITNESS CLUB MANAGEMENT</p><h1>{current?.[1]}</h1></div><div className="header-status"><span className={health.database === 'connected' ? 'status-dot' : 'status-dot offline'} />{health.database === 'connected' ? 'Live database' : 'Configuration needed'}</div></header>
      {health.error && <div className="alert error"><strong>Connection unavailable:</strong> {health.error}</div>}
      {section === 'dashboard' ? <Dashboard onNavigate={setSection} /> : section === 'relationships' ? <Relationships /> : section === 'attendance' ? <Attendance /> : <ResourcePage resource={section} />}
    </main>
  </div>;
}

function Dashboard({ onNavigate }) {
  const [data, setData] = useState(null); const [error, setError] = useState('');
  useEffect(() => { api('/dashboard').then(setData).catch((e) => setError(e.message)); }, []);
  const cards = [['members', 'Members', Users], ['plans', 'Plans', ShieldCheck], ['trainers', 'Trainers', UserRound], ['sessions', 'Sessions', Dumbbell], ['payments', 'Payments', CreditCard], ['relationships', 'Relationships', Link2]];
  return <><section className="welcome"><div><p className="eyebrow">OVERVIEW</p><h2>Good morning, club admin.</h2><p>Live counts from your existing Neo4j Aura graph.</p></div><div className="welcome-icon"><BarChart3 size={30} /></div></section>{error && <div className="alert error">{error}</div>}<div className="stat-grid">{cards.map(([key, label, Icon]) => <button className="stat-card" key={key} onClick={() => onNavigate(key)}><div className={`stat-icon ${key}`}><Icon size={19} /></div><div><span>{label}</span><strong>{data?.[key] ?? '...'}</strong></div><ArrowRight className="card-arrow" size={17} /></button>)}</div><div className="dashboard-grid"><div className="panel"><div className="panel-heading"><div><p className="eyebrow">SYSTEM STATUS</p><h3>Database snapshot</h3></div><span className="live-pill">LIVE</span></div><p className="muted">This application reads and writes only the records you request. It never seeds, resets, or deletes connected records.</p><div className="snapshot"><span><b>{data?.members ?? '...'}</b> members</span><span><b>{data?.sessions ?? '...'}</b> sessions</span><span><b>{data?.relationships ?? '...'}</b> links</span></div></div><div className="panel accent-panel"><p className="eyebrow">QUICK TIP</p><h3>Graph relationships</h3><p className="muted">Use the relationship view to inspect and manage plan, trainer, attendance, and payment links.</p><button className="text-button" onClick={() => onNavigate('relationships')}>Explore connections <ArrowRight size={15} /></button></div></div></>;
}

const fieldMap = {
  members: ['name', 'email', 'phone', 'gender', 'joinDate', 'status'],
  plans: ['name', 'price', 'duration', 'description', 'status'],
  trainers: ['name', 'specialization', 'email', 'phone', 'status'],
  sessions: ['title', 'date', 'time', 'duration', 'location', 'description', 'status'],
  payments: ['amount', 'paymentDate', 'method', 'status', 'description', 'transactionId']
};

function ResourcePage({ resource }) {
  const [items, setItems] = useState([]); const [search, setSearch] = useState(''); const [modal, setModal] = useState(false); const [editing, setEditing] = useState(null); const [message, setMessage] = useState(null); const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); api(`/${resource}?search=${encodeURIComponent(search)}`).then(setItems).catch((e) => setMessage({ type: 'error', text: e.message })).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [resource, search]);
  const columns = useMemo(() => { const keys = new Set(); items.slice(0, 20).forEach((item) => Object.keys(item).filter((key) => !['elementId', 'id', 'label'].includes(key)).forEach((key) => keys.add(key))); return [...keys].slice(0, 6); }, [items]);
  const save = async (values) => { try { if (editing) await api(`/${resource}/${editing.elementId || editing.id}`, { method: 'PATCH', body: JSON.stringify(values) }); else await api(`/${resource}`, { method: 'POST', body: JSON.stringify(values) }); setModal(false); setEditing(null); setMessage({ type: 'success', text: `${labels[resource]} saved successfully.` }); load(); } catch (e) { setMessage({ type: 'error', text: e.message }); } };
  const remove = async (item) => { if (!window.confirm('Delete this record? Connected records are protected.')) return; try { await api(`/${resource}/${item.elementId || item.id}`, { method: 'DELETE' }); setMessage({ type: 'success', text: 'Record deleted.' }); load(); } catch (e) { setMessage({ type: 'error', text: e.message }); } };
  return <><div className="toolbar"><div className="search-box"><Search size={17} /><input placeholder={`Search ${labels[resource]} records...`} value={search} onChange={(e) => setSearch(e.target.value)} /></div><button className="primary-button" onClick={() => { setEditing(null); setModal(true); }}><Plus size={17} />Add {labels[resource]}</button></div>{message && <div className={`alert ${message.type}`}>{message.text}<button onClick={() => setMessage(null)}><X size={15} /></button></div>}<div className="panel table-panel">{loading ? <Loading /> : items.length ? <DataTable items={items} columns={columns} onEdit={(item) => { setEditing(item); setModal(true); }} onDelete={remove} /> : <Empty resource={resource} />}</div>{resource === 'plans' && <PlanAssignment />}{resource === 'payments' && <PaymentAssignment />}{modal && <RecordModal resource={resource} item={editing} onSave={save} onClose={() => { setModal(false); setEditing(null); }} />}</>;
}

function DataTable({ items, columns, onEdit, onDelete }) { return <div className="table-wrap"><table><thead><tr><th>Record</th>{columns.map((key) => <th key={key}>{pretty(key)}</th>)}<th /></tr></thead><tbody>{items.map((item) => <tr key={item.elementId || item.id}><td><strong>{item.name || item.fullName || item.title || item.id}</strong><small>{item.id}</small></td>{columns.map((key) => <td key={key}>{String(item[key] ?? '-')}</td>)}<td><div className="row-actions"><button onClick={() => onEdit(item)}>Edit</button><button className="danger-text" onClick={() => onDelete(item)}>Delete</button></div></td></tr>)}</tbody></table></div>; }
function RecordModal({ resource, item, onSave, onClose }) { const [values, setValues] = useState(item ? { ...item } : {}); const fields = fieldMap[resource]; return <div className="modal-backdrop"><div className="modal"><div className="modal-heading"><div><p className="eyebrow">{item ? 'EDIT RECORD' : 'NEW RECORD'}</p><h2>{item ? 'Update details' : `Add ${labels[resource]}`}</h2></div><button onClick={onClose}><X /></button></div><form onSubmit={(e) => { e.preventDefault(); onSave(values); }}><div className="form-grid">{fields.map((field) => <label key={field}>{pretty(field)}<input type={field === 'amount' || field === 'price' || field === 'duration' ? 'number' : field.includes('Date') || field === 'date' ? 'date' : 'text'} value={values[field] ?? ''} onChange={(e) => setValues({ ...values, [field]: e.target.value })} placeholder={`Enter ${pretty(field).toLowerCase()}`} /></label>)}</div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Save record</button></div></form></div></div>; }

function useOptions() {
  const [data, setData] = useState(() => Object.fromEntries(optionResources.map((key) => [key, []])));
  useEffect(() => { Promise.all(optionResources.map((key) => api(`/${key}`))).then((values) => setData(Object.fromEntries(optionResources.map((key, index) => [key, values[index]])))).catch((error) => setData((current) => ({ ...current, error: error.message }))); }, []);
  return data;
}
function SelectField({ label, value, onChange, options, placeholder }) { return <label>{label}<select required value={value || ''} onChange={(e) => onChange(e.target.value)}><option value="">{placeholder}</option>{options.map((item) => <option key={item.elementId} value={item.elementId}>{item.name || item.fullName || item.title || item.id}</option>)}</select></label>; }
function LinkForm({ type, from, to, fromLabel, toLabel, onDone, loadError }) { const [values, setValues] = useState({}); const [message, setMessage] = useState(null); const submit = async (event) => { event.preventDefault(); try { await api('/relationships', { method: 'POST', body: JSON.stringify({ type, fromId: values.fromId, toId: values.toId }) }); setMessage({ type: 'success', text: 'Relationship saved.' }); setValues({}); onDone?.(); } catch (error) { setMessage({ type: 'error', text: error.message }); } }; return <>{loadError && <div className="alert error">{loadError}</div>}<form onSubmit={submit} className="assignment-form"><SelectField label={fromLabel} value={values.fromId} onChange={(value) => setValues({ ...values, fromId: value })} options={from} placeholder={`Choose ${fromLabel.toLowerCase()}`} /><SelectField label={toLabel} value={values.toId} onChange={(value) => setValues({ ...values, toId: value })} options={to} placeholder={`Choose ${toLabel.toLowerCase()}`} /><button className="primary-button" type="submit">Create link <ArrowRight size={16} /></button></form>{message && <div className={`alert ${message.type}`}>{message.text}</div>}</>; }
function PlanAssignment() { const options = useOptions(); return <div className="panel assignment-panel"><p className="eyebrow">MEMBER PLAN</p><h3>Assign a membership plan</h3><p className="muted">Creates a HAS_PLAN relationship between existing records.</p><LinkForm type="HAS_PLAN" from={options.members} to={options.plans} fromLabel="Member" toLabel="Membership plan" loadError={options.error} /></div>; }
function PaymentAssignment() { const options = useOptions(); return <div className="panel assignment-panel"><p className="eyebrow">PAYMENT OWNER</p><h3>Attach a payment to a member</h3><p className="muted">Create the payment above, then connect it to its member here.</p><LinkForm type="MADE_PAYMENT" from={options.members} to={options.payments} fromLabel="Member" toLabel="Payment" loadError={options.error} /></div>; }
function Attendance() { const options = useOptions(); const [refreshKey, setRefreshKey] = useState(0); return <div className="narrow-content"><div className="panel form-panel"><p className="eyebrow">ATTENDANCE</p><h2>Record attendance</h2><p className="muted">Select existing member and workout session records. No duplicate links are created.</p><LinkForm type="ATTENDS" from={options.members} to={options.sessions} fromLabel="Member" toLabel="Workout session" loadError={options.error} onDone={() => setRefreshKey((value) => value + 1)} /></div><RelationshipList filter="ATTENDS" refreshKey={refreshKey} /></div>; }
function Relationships() { const [refreshKey, setRefreshKey] = useState(0); return <div><RelationshipList refreshKey={refreshKey} /><div className="panel assignment-panel"><p className="eyebrow">CREATE CONNECTION</p><h3>Connect existing records</h3><RelationshipCreator onDone={() => setRefreshKey((value) => value + 1)} /></div></div>; }
function RelationshipCreator({ onDone }) { const options = useOptions(); const [type, setType] = useState('HAS_PLAN'); const config = relationTypes.find((item) => item[0] === type); const fromKey = config[1] === 'Member' ? 'members' : 'trainers'; const toKey = config[2] === 'Plan' ? 'plans' : config[2] === 'Payment' ? 'payments' : 'sessions'; return <><label className="relation-type">Relationship<select value={type} onChange={(e) => setType(e.target.value)}>{relationTypes.map(([value]) => <option key={value}>{value}</option>)}</select></label><LinkForm type={type} from={options[fromKey]} to={options[toKey]} fromLabel={config[1]} toLabel={config[2]} loadError={options.error} onDone={onDone} /></>; }
function displayNode(node, fallbackId) {
  if (!node) return { name: fallbackId, detail: 'Record ID' };
  const name = node.name || node.fullName || node.title
    || node.workouttype || node.workoutType
    || node.description || node.type
    || (node.sessionid ? `Workout session ${node.sessionid}` : null)
    || (node.paymentid ? `Payment ${node.paymentid}` : null)
    || fallbackId;
  const detail = node.sessiondate || node.date || node.paymentdate || node.paymentDate
    || node.email || node.location || (node.sessionid ? `Session ${node.sessionid}` : 'Record');
  return { name: String(name), detail: String(detail) };
}
function RelationshipList({ filter, refreshKey = 0 }) { const [items, setItems] = useState([]); const [error, setError] = useState(''); const load = () => api('/relationships').then((data) => setItems(filter ? data.filter((item) => item.relationship === filter) : data)).catch((e) => setError(e.message)); useEffect(() => { load(); }, [filter, refreshKey]); const remove = async (item) => { try { await api('/relationships', { method: 'DELETE', body: JSON.stringify({ type: item.relationship, fromId: item.fromId, toId: item.toId }) }); load(); } catch (e) { setError(e.message); } }; return <div className="panel table-panel">{error && <div className="alert error">{error}</div>}{items.length ? <div className="table-wrap"><table><thead><tr><th>From</th><th>Relationship</th><th>To</th><th /></tr></thead><tbody>{items.map((item, index) => { const from = displayNode(item.from, item.fromId); const to = displayNode(item.to, item.toId); return <tr key={`${item.fromId}-${item.toId}-${index}`}><td><strong>{from.name}</strong><small>{item.fromLabel} · {from.detail}</small></td><td><span className="relationship-badge">{item.relationship}</span></td><td><strong>{to.name}</strong><small>{item.toLabel} · {to.detail}</small></td><td><button className="danger-text" onClick={() => remove(item)}>Remove</button></td></tr>; })}</tbody></table></div> : <Empty resource={filter ? 'attendance records' : 'relationships'} />}</div>; }
function Loading() { return <div className="loading"><span />Loading records...</div>; }
function Empty({ resource }) { return <div className="empty"><div className="empty-icon"><Search size={22} /></div><h3>No {resource} found</h3><p>Connect Neo4j or add a record to see it here.</p></div>; }

const rootContainer = document.getElementById('root');
const appRoot = globalThis.__fitnessClubRoot || createRoot(rootContainer);
globalThis.__fitnessClubRoot = appRoot;
appRoot.render(<AppErrorBoundary><App /></AppErrorBoundary>);
