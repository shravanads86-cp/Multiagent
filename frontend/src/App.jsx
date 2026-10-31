import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const apiBase = 'http://127.0.0.1:8000/api'
const developmentAgents = ['Planning Agent', 'Coding Agent', 'Build Agent', 'Testing Agent']
const operationsAgents = ['Security Agent', 'Release Agent', 'Deploy Agent', 'Monitor Agent']
const allAgents = [...developmentAgents, ...operationsAgents]
const implementedAgents = new Set(['Planning Agent', 'Coding Agent'])

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('signin')
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (mode === 'signup' && form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (form.password.length < 8) {
      setError('Password must contain at least 8 characters.')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`${apiBase}/auth/${mode === 'signup' ? 'signup' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(mode === 'signup' ? { name: form.name.trim() } : {}),
          email: form.email.trim().toLowerCase(),
          password: form.password,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        const detail = result.detail
        throw new Error(typeof detail === 'string' ? detail : 'Unable to authenticate. Please check your details and try again.')
      }
      localStorage.setItem('swarm-token', result.access_token)
      localStorage.setItem('swarm-user', JSON.stringify(result.user))
      onAuthenticated(result.user)
    } catch (err) {
      setError(err.message || 'Unable to reach the authentication server. Make sure the backend is running.')
    } finally {
      setSubmitting(false)
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode)
    setError('')
    setForm({ name: '', email: form.email, password: '', confirmPassword: '' })
  }

  return <main className="auth-page">
    <section className="auth-intro">
      <p className="eyebrow">AUTONOMOUS DEVOPS SWARM</p>
      <h1>Eight agents. One reliable release.</h1>
      <p>Plan, build, secure, deploy, and observe every delivery workflow from one calm control room.</p>
      <div className="auth-points"><span>◈ Eight specialised agents</span><span>◈ Observable pipelines</span><span>◈ Safer releases</span></div>
    </section>
    <section className="auth-card">
      <div className="auth-tabs">
        <button type="button" className={mode === 'signin' ? 'active' : ''} onClick={() => changeMode('signin')}>Sign in</button>
        <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => changeMode('signup')}>Create account</button>
      </div>
      <div className="auth-heading">
        <p className="section-label">{mode === 'signin' ? 'WELCOME BACK' : 'CREATE ACCOUNT'}</p>
        <p>{mode === 'signin' ? 'Sign in to access mission control.' : 'Create your account to start orchestrating delivery missions.'}</p>
      </div>
      <form className="auth-form" onSubmit={submit}>
        {mode === 'signup' && <label>Full name<input autoComplete="name" value={form.name} onChange={update('name')} placeholder="Alex Morgan" minLength={2} maxLength={80} required /></label>}
        <label>Email<input type="email" autoComplete="email" value={form.email} onChange={update('email')} placeholder="you@example.com" required /></label>
        <label>Password<input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={form.password} onChange={update('password')} placeholder="At least 8 characters" minLength={8} maxLength={128} required /></label>
        {mode === 'signup' && <label>Confirm password<input type="password" autoComplete="new-password" value={form.confirmPassword} onChange={update('confirmPassword')} placeholder="Re-enter your password" minLength={8} required /></label>}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
      </form>
      <p className="auth-note">Your account is securely stored by the backend. Passwords are never stored as plain text.</p>
    </section>
  </main>
}
function App() {
  const [user, setUser] = useState(() => { try { const saved = JSON.parse(localStorage.getItem('swarm-user') || 'null'); return saved && typeof saved === 'object' ? saved : null } catch { return null } })
  const [page, setPage] = useState('dashboard')
  const [request, setRequest] = useState('Build a student management portal')
  const [pipeline, setPipeline] = useState(null)
  const [history, setHistory] = useState([])
  const [failures, setFailures] = useState([])
  const [storage, setStorage] = useState('loading')
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const [healingSimulating, setHealingSimulating] = useState(false)
  const [logLevel, setLogLevel] = useState('all')
  const [clearedLogs, setClearedLogs] = useState(false)
  const [settings, setSettings] = useState(() => {
    const saved = JSON.parse(localStorage.getItem('swarm-settings') || '{}')
    return { theme: saved.theme === 'light' ? 'light' : 'dark', notifications: saved.notifications ?? true, codingAgent: saved.codingAgent ?? true }
  })
  const [selectedAgent, setSelectedAgent] = useState('Planning Agent')
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [missionEditPending, setMissionEditPending] = useState(false)
  const [workflowMinimized, setWorkflowMinimized] = useState(false)
  const [workflowExpanded, setWorkflowExpanded] = useState(false)
  const missionInputRef = useRef(null)

  async function loadHistory() { 
    const response = await fetch(`${apiBase}/pipelines`)
    if (!response.ok) throw new Error('Could not load pipeline history.')
    const data = await response.json()
    setHistory(data.pipelines)
    setStorage(data.storage) 
  }

  async function loadFailures() {
    try {
      const res = await fetch(`${apiBase}/failures`)
      if (res.ok) {
        const data = await res.json()
        setFailures(data.failures || [])
      }
    } catch {
      // safe fallback
    }
  }

  useEffect(() => { 
    if (user) {
      loadHistory().catch(() => setStorage('backend unavailable'))
      loadFailures()
    }
  }, [user])

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
    localStorage.setItem('swarm-settings', JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    if (page !== 'dashboard' || !missionEditPending) return
    missionInputRef.current?.focus()
    missionInputRef.current?.select()
    setMissionEditPending(false)
  }, [page, missionEditPending])

  async function runPipeline(event) { 
    event.preventDefault()
    setRunning(true)
    setError('')
    setClearedLogs(false)
    try { 
      const response = await fetch(`${apiBase}/pipelines`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ request }) 
      })
      if (!response.ok) throw new Error('The backend could not start the pipeline.')
      setPipeline(await response.json())
      setPage('dashboard')
      await loadHistory()
      await loadFailures()
    } catch (err) { 
      setError(err.message) 
    } finally { 
      setRunning(false) 
    } 
  }

  async function triggerSimulatedFailure() {
    setHealingSimulating(true)
    setError('')
    try {
      const response = await fetch(`${apiBase}/pipelines/simulate-failure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request: `${request} (Self-Healing Test)` })
      })
      if (!response.ok) throw new Error('Could not execute simulated failure.')
      const result = await response.json()
      setPipeline(result)
      setPage('dashboard')
      await loadHistory()
      await loadFailures()
    } catch (err) {
      setError(err.message)
    } finally {
      setHealingSimulating(false)
    }
  }

  const editMission = () => {
    setInspectorOpen(false)
    setMissionEditPending(true)
    setPage('dashboard')
  }

  const stageFor = (agent) => {
    if (!implementedAgents.has(agent)) return { agent, status: 'pending' }
    return pipeline?.stages.find((stage) => stage.agent === agent) ?? { agent, status: 'waiting' }
  }

  const logs = useMemo(() => { 
    if (clearedLogs) return []
    const list = pipeline?.logs ?? []
    return logLevel === 'all' ? list : list.filter((log) => log.message.toLowerCase().includes(logLevel)) 
  }, [pipeline, logLevel, clearedLogs])

  const observer = pipeline?.observer
  const nav = [
    ['dashboard', 'Dashboard'], 
    ['healing', 'Self-Healing'],
    ['agents', 'Agents'], 
    ['logs', 'Logs'], 
    ['database', 'Database'], 
    ['settings', 'Settings']
  ]

  const openInspector = (agent) => { setSelectedAgent(agent); setInspectorOpen(true) }

  const renderStages = (agents) => <ul className="agent-list">{agents.map((agent) => { 
    const stage = stageFor(agent)
    return <li key={agent} onClick={() => openInspector(agent)} style={{ cursor: 'pointer' }}>
      <span className={`agent-dot ${stage.status}`} />
      <div>
        <strong>{agent}</strong>
        <small>{stage.status === 'completed' ? `Completed${stage.duration_ms ? ` · ${stage.duration_ms}ms` : ''}` : stage.status === 'healed' ? '⚡ Healed by Self-Healing Agent' : stage.status}</small>
      </div>
      <span className={`status-pill ${stage.status}`}>{stage.status}</span>
    </li> 
  })}</ul>

  if (!user) return <AuthScreen onAuthenticated={setUser} />

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand">
        <span>◈</span>
        <div><strong>Swarm</strong><small>DevOps control</small></div>
      </div>
      <nav>
        {nav.map(([key, label]) => (
          <button key={key} className={page === key ? 'selected' : ''} onClick={() => setPage(key)}>
            {key === 'healing' ? '⚡ ' : ''}{label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer"><span className="online-dot" />System online</div>
    </aside>

    <section className="workspace">
      <header className="topbar">
        <div>
          <p className="eyebrow">{page.toUpperCase()}</p>
          <h1>{page === 'dashboard' ? 'Mission control' : page === 'healing' ? 'Self-Healing & DB Failure Memory' : page[0].toUpperCase() + page.slice(1)}</h1>
        </div>
        <div className="user-menu">
          <span className="avatar">{user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}</span>
          <div><strong>{user.name}</strong><small>{user.email}</small></div>
          <button title="Sign out" className="signout" onClick={() => { localStorage.removeItem('swarm-user'); localStorage.removeItem('swarm-token'); setUser(null) }}>Sign out</button>
        </div>
      </header>

      {page === 'dashboard' && <>
        <section className="command-card">
          <div>
            <p className="section-label">AI COMMAND PROMPT</p>
            <h2>Launch a delivery mission</h2>
          </div>
          <form onSubmit={runPipeline}>
            <input ref={missionInputRef} value={request} onChange={(event) => setRequest(event.target.value)} minLength="3" required />
            <button className="primary-button" disabled={running || healingSimulating}>
              {running ? 'Launching…' : 'Submit mission'}
            </button>
          </form>
          {error && <p className="error">{error} Start the backend at port 8000 and try again.</p>}
        </section>

        <section className="metrics">
          <div><span>Pipeline status</span><strong className={pipeline?.status}>{pipeline?.status ?? 'Ready'}</strong></div>
          <div><span>CPU usage</span><strong>{pipeline?.stages.at(-1)?.output?.cpu ?? '—'}</strong></div>
          <div><span>Memory usage</span><strong>{pipeline?.stages.at(-1)?.output?.memory ?? '—'}</strong></div>
          <div><span>DB Incidents Healed</span><strong className="completed">{failures.length}</strong></div>
          <div><span>Health status</span><strong className="completed">{pipeline?.stages.at(-1)?.output?.health ?? 'Waiting'}</strong></div>
        </section>

        <section className="content-grid">
          <div className="panel">
            <div className="panel-heading">
              <div><p className="section-label">ACTIVE AGENTS</p><h2>Development team</h2></div>
              <div className="actions">
                <button onClick={() => openInspector(selectedAgent)}>Inspect</button>
                <button onClick={editMission}>Edit</button>
                <span className="badge">{pipeline?.progress ?? 0}%</span>
              </div>
            </div>
            {renderStages(developmentAgents)}
          </div>

          <div className="panel">
            <div className="panel-heading">
              <div><p className="section-label">OPERATIONS</p><h2>Release team</h2></div>
              <div className="actions">
                <button onClick={() => openInspector(selectedAgent)}>Inspect</button>
                <button onClick={editMission}>Edit</button>
              </div>
            </div>
            {renderStages(operationsAgents)}
          </div>
        </section>

        <section className="panel observer">
          <div><p className="section-label">SWARM OBSERVER</p><h2>Pipeline inspection</h2></div>
          <div className="observer-stats">
            <span><b>{observer?.agents_monitored ?? 0}</b> Agents monitored</span>
            <span><b>{observer?.failures_detected ?? 0}</b> Failures</span>
            <span><b>{failures.length}</b> Self-Healed in DB</span>
            <span>{observer?.message ?? 'Awaiting a mission.'}</span>
          </div>
        </section>
      </>}

      {page === 'healing' && <SelfHealingScreen failures={failures} storage={storage} onRefresh={loadFailures} onSimulate={triggerSimulatedFailure} simulating={healingSimulating} />}
      {page === 'agents' && <section className="panel"><p className="section-label">AGENT DIRECTORY</p><h2>Specialists in this swarm</h2><div className="agent-cards">{allAgents.map((agent, index) => <article key={agent}><span>{String(index + 1).padStart(2, '0')}</span><h3>{agent}</h3><p>{stageFor(agent).status === 'waiting' ? 'Ready for a mission' : stageFor(agent).status}</p><button onClick={() => openInspector(agent)}>Inspect agent</button></article>)}</div></section>}
      {page === 'logs' && <section className="panel"><div className="panel-heading"><div><p className="section-label">EXECUTION LOGS</p><h2>Swarm activity</h2></div><div className="actions"><select value={logLevel} onChange={(event) => setLogLevel(event.target.value)}><option value="all">All logs</option><option value="started">Started</option><option value="completed">Completed</option><option value="failed">Failed</option></select><button onClick={() => setClearedLogs(true)}>Clear logs</button></div></div><div className="logs">{logs.length ? logs.map((log, i) => <p key={`${log.timestamp}-${i}`}><span>{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '—'}</span>{log.message}</p>) : <p>No logs to display.</p>}</div></section>}
      {page === 'database' && <section className="panel"><div className="panel-heading"><div><p className="section-label">PIPELINE DATABASE</p><h2>Mission history</h2></div><button onClick={() => loadHistory().catch(() => setError('Could not refresh history.'))}>Refresh</button></div><p className="storage">Storage: {storage}</p><div className="table-wrap"><table><thead><tr><th>Request</th><th>Status</th><th>Agents</th><th>Updated</th></tr></thead><tbody>{history.length ? history.map((item) => <tr key={item.task.id}><td>{item.task.request}</td><td><span className={`status-pill ${item.status}`}>{item.status}</span></td><td>{item.stages.length}</td><td>{new Date(item.updated_at).toLocaleString()}</td></tr>) : <tr><td colSpan="4">No saved missions yet.</td></tr>}</tbody></table></div></section>}
      {page === 'settings' && <section className="panel settings"><div className="panel-heading"><div><p className="section-label">PREFERENCES</p><h2>Workspace settings</h2></div><button onClick={() => setSettings({ theme: 'dark', notifications: true, codingAgent: true })}>Reset</button></div><label>Theme<select value={settings.theme} onChange={(e) => setSettings({ ...settings, theme: e.target.value })}><option value="dark">Dark</option><option value="light">Light</option></select></label><label className="toggle-row"><span><b>Pipeline alerts</b><small>Notify when a pipeline needs attention.</small></span><input type="checkbox" checked={settings.notifications} onChange={(e) => setSettings({ ...settings, notifications: e.target.checked })} /></label><label className="toggle-row"><span><b>Coding agent</b><small>Allow the coding specialist in new missions.</small></span><input type="checkbox" checked={settings.codingAgent} onChange={(e) => setSettings({ ...settings, codingAgent: e.target.checked })} /></label><button className="primary-button" onClick={() => alert('Settings saved for this session.')}>Save changes</button></section>}

      {page === 'dashboard' && <WorkflowSidebar pipeline={pipeline} request={request} onInspect={openInspector} minimized={workflowMinimized} expanded={workflowExpanded} onMinimize={() => setWorkflowMinimized(!workflowMinimized)} onExpand={() => { setWorkflowMinimized(false); setWorkflowExpanded(!workflowExpanded) }} />}
      {inspectorOpen && <InspectModal agent={selectedAgent} stage={stageFor(selectedAgent)} request={request} onClose={() => setInspectorOpen(false)} onEdit={editMission} />}
    </section>
  </main>
}

export default App

function SelfHealingScreen({ failures, storage, onRefresh, onSimulate, simulating }) {
  const [selectedFailure, setSelectedFailure] = useState(null)

  return <section className="panel self-healing-screen">
    <div className="panel-heading">
      <div>
        <p className="section-label">AUTONOMOUS SELF-HEALING & DATABASE MEMORY</p>
        <h2>Zero-Human Intervention Failure Recovery</h2>
      </div>
      <div className="actions">
        <button onClick={onRefresh}>🔄 Refresh DB Memory</button>
        <button className="primary-button" onClick={onSimulate} disabled={simulating}>
          {simulating ? '⚡ Auto-Healing in progress…' : '🧪 Simulate Failure & Auto-Heal'}
        </button>
      </div>
    </div>

    {/* Metric Cards */}
    <div className="metrics" style={{ marginTop: 20 }}>
      <div><span>Auto-Healed Incidents</span><strong className="completed">{failures.length}</strong></div>
      <div><span>Human Intervention</span><strong className="completed">0% (Fully Autonomous)</strong></div>
      <div><span>Database Persistence</span><strong>{storage}</strong></div>
      <div><span>Knowledge Memory Retained</span><strong className="completed">{failures.length} Records</strong></div>
      <div><span>Auto-Remediation Rate</span><strong className="completed">100%</strong></div>
    </div>

    <div className="section-block" style={{ marginTop: 24 }}>
      <h4>⚡ Database Failure Memory & Knowledge Base</h4>
      <p className="section-subtitle">
        Failure details, error diagnostics, and self-healing resolutions stored in Database Memory for future interactions.
      </p>

      {failures.length > 0 ? (
        <div className="table-wrap">
          <table className="failures-table">
            <thead>
              <tr>
                <th>Mission Request</th>
                <th>Failed Agent</th>
                <th>Root Cause Analysis</th>
                <th>Self-Healing Remediation Applied</th>
                <th>Status</th>
                <th>Recorded At</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {failures.map((fail) => (
                <tr key={fail.failure_id}>
                  <td><strong>{fail.mission_request}</strong></td>
                  <td><span className="agent-badge">{fail.failed_agent}</span></td>
                  <td><span className="cause-text">{fail.root_cause}</span></td>
                  <td><span className="healing-text">{fail.healing_action}</span></td>
                  <td><span className="status-pill completed">⚡ {fail.status}</span></td>
                  <td><small>{new Date(fail.healed_at).toLocaleTimeString()}</small></td>
                  <td>
                    <button className="btn-small" onClick={() => setSelectedFailure(fail)}>Inspect DB Record</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state-card">
          <p>No failure incidents recorded in DB yet. Click <strong>"Simulate Failure & Auto-Heal"</strong> above to test zero-human intervention self-healing!</p>
        </div>
      )}
    </div>

    {/* Failure Inspection Modal */}
    {selectedFailure && (
      <div role="dialog" aria-modal="true" className="modal-backdrop" onMouseDown={() => setSelectedFailure(null)}>
        <section className="inspect-modal-panel" onMouseDown={(e) => e.stopPropagation()} style={{ width: 'min(780px, 100%)' }}>
          <div className="panel-heading">
            <div>
              <p className="section-label">DATABASE FAILURE MEMORY RECORD</p>
              <h2>Incident #{selectedFailure.failure_id.slice(0, 8)}</h2>
            </div>
            <button className="close-btn" onClick={() => setSelectedFailure(null)}>✕</button>
          </div>
          <div className="modal-body" style={{ display: 'grid', gap: 16 }}>
            <div className="plan-summary-card">
              <h3>🎯 Mission Context</h3>
              <p>{selectedFailure.mission_request}</p>
            </div>
            <div className="arch-card">
              <span className="arch-icon">🚨</span>
              <div>
                <strong>Failed Component: {selectedFailure.failed_agent}</strong>
                <p><code>{selectedFailure.error_signature}</code></p>
              </div>
            </div>
            <div className="arch-card">
              <span className="arch-icon">🩺</span>
              <div>
                <strong>Diagnosed Root Cause</strong>
                <p>{selectedFailure.root_cause}</p>
              </div>
            </div>
            <div className="arch-card" style={{ borderColor: '#153c2c' }}>
              <span className="arch-icon">⚡</span>
              <div>
                <strong style={{ color: '#86efac' }}>Autonomous Self-Healing Action Applied</strong>
                <p>{selectedFailure.healing_action}</p>
              </div>
            </div>
            <pre className="raw-json">{JSON.stringify(selectedFailure, null, 2)}</pre>
          </div>
        </section>
      </div>
    )}
  </section>
}

function WorkflowSidebar({ pipeline, request, onInspect, minimized, expanded, onMinimize, onExpand }) {
  const planning = pipeline?.stages.find((stage) => stage.agent === 'Planning Agent')
  const coding = pipeline?.stages.find((stage) => stage.agent === 'Coding Agent')

  return <aside className={`workflow-sidebar${minimized ? ' minimized' : ''}${expanded ? ' expanded' : ''}`} aria-label="Mission workflow">
    <div className="workflow-controls"><button title={minimized ? 'Open workflow' : 'Minimize workflow'} aria-label={minimized ? 'Open workflow' : 'Minimize workflow'} onClick={onMinimize}>{minimized ? '‹' : '›'}</button>{!minimized && <button title={expanded ? 'Use normal width' : 'Expand workflow'} aria-label={expanded ? 'Use normal width' : 'Expand workflow'} onClick={onExpand}>{expanded ? '↔' : '⤢'}</button>}</div>
    {!minimized && <><div className="workflow-sidebar-heading"><div><p className="section-label">LIVE WORKFLOW</p><h2>Agent handoff</h2></div><span className={`status-pill ${pipeline?.status ?? 'waiting'}`}>{pipeline?.status ?? 'ready'}</span></div>
    <p className="workflow-request">{pipeline ? `Mission: ${pipeline.task.request}` : `Ready to plan: ${request}`}</p>
    <WorkflowStage title="1. Planning Agent" agentName="Planning Agent" status={planning?.status} stageData={planning} empty="Submit a mission to see requirements, architecture, API contracts, and the step-by-step delivery plan." onInspect={() => onInspect('Planning Agent')} />
    <WorkflowStage title="2. Coding Agent" agentName="Coding Agent" status={coding?.status} stageData={coding} empty="The coding blueprint appears after the planning handoff, showing full source code files for backend & frontend." onInspect={() => onInspect('Coding Agent')} />
    {pipeline && <div className="workflow-next"><p className="section-label">NEXT HANDOFF</p><strong>Build Agent — pending</strong><span>Build, test, security, release, deployment, and monitoring remain pending until their real implementations are added.</span></div>}</>}
  </aside>
}

function WorkflowStage({ title, agentName, status, stageData, empty, onInspect }) {
  const output = stageData?.output
  const summary = output?.summary
  const steps = agentName === 'Planning Agent' ? (output?.implementation_steps ?? []) : (output?.implementation_order ?? [])
  const files = output?.files_to_create ?? []

  return <section className={`workflow-stage ${status ?? 'waiting'}`}>
    <div className="workflow-stage-heading">
      <div><h3>{title}</h3><span>{status ?? 'Waiting for mission'}</span></div>
      {status === 'completed' && <span className="workflow-check">✓</span>}
      {status === 'healed' && <span className="workflow-check" style={{ background: '#1e3a8a', color: '#93c5fd' }}>⚡</span>}
    </div>
    
    {summary ? <p className="workflow-summary">{summary}</p> : <p className="workflow-empty">{empty}</p>}

    {/* Plan Preview */}
    {agentName === 'Planning Agent' && output?.domain_models?.length > 0 && (
      <div className="mini-card-list">
        <p className="mini-label">SYNTHESIZED MODELS:</p>
        <div className="tag-group">
          {output.domain_models.map(m => <span key={m.name} className="model-tag">⚡ {m.name}</span>)}
        </div>
      </div>
    )}

    {/* Code File Preview Badges */}
    {agentName === 'Coding Agent' && files.length > 0 && (
      <div className="mini-card-list">
        <p className="mini-label">GENERATED SOURCE CODE ({files.length} FILES):</p>
        <div className="file-tag-group">
          {files.map(f => (
            <span key={f.path} className="file-badge">
              📄 {f.path.split('/').pop()}
            </span>
          ))}
        </div>
      </div>
    )}

    {/* Steps List */}
    {steps.length > 0 && (
      <ol className="workflow-steps">
        {steps.map((item) => (
          <li key={item.step}>
            <span>{item.step}</span>
            <div>
              <strong>{item.title ?? item.area}</strong>
              <p>{item.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    )}

    <button className="workflow-details primary-link" onClick={onInspect}>
      {summary ? `🔍 Open Full ${agentName} Output` : 'Inspect agent'}
    </button>
  </section>
}

function InspectModal({ agent, stage, request, onClose, onEdit }) {
  const [viewMode, setViewMode] = useState('formatted') // 'formatted' | 'raw'
  const output = stage?.output

  return <div role="dialog" aria-modal="true" aria-label="Agent inspection" className="modal-backdrop" onMouseDown={onClose}>
    <section className="inspect-modal-panel" onMouseDown={(event) => event.stopPropagation()}>
      <div className="panel-heading">
        <div>
          <p className="section-label">AGENT MISSION INSPECTOR</p>
          <h2>{agent}</h2>
        </div>
        <div className="actions">
          <div className="view-toggle">
            <button className={viewMode === 'formatted' ? 'active' : ''} onClick={() => setViewMode('formatted')}>✨ Formatted AI Output</button>
            <button className={viewMode === 'raw' ? 'active' : ''} onClick={() => setViewMode('raw')}>{'{ }'} Raw JSON</button>
          </div>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>
      </div>

      <div className="metrics-strip">
        <div><span>Status</span><strong className={stage.status}>{stage.status}</strong></div>
        <div><span>Execution Time</span><strong>{stage.duration_ms ? `${stage.duration_ms}ms` : '—'}</strong></div>
        <div><span>Mission</span><strong className="mission-text">{request}</strong></div>
      </div>

      <div className="modal-body">
        {!output ? (
          <div className="empty-state">Submit a mission to generate detailed plans and complete source code files.</div>
        ) : viewMode === 'raw' ? (
          <pre className="raw-json">{JSON.stringify(output, null, 2)}</pre>
        ) : agent === 'Planning Agent' ? (
          <PlanViewer plan={output} />
        ) : agent === 'Coding Agent' ? (
          <CodeExplorer files={output.files_to_create || []} summary={output.summary} _planUsed={output.plan_used} order={output.implementation_order || []} result={output.user_visible_result} />
        ) : (
          <pre className="raw-json">{JSON.stringify(output, null, 2)}</pre>
        )}
      </div>

      <div className="panel-footer">
        <button onClick={onEdit}>Edit Mission</button>
        <button className="primary-button" onClick={() => navigator.clipboard?.writeText(JSON.stringify(output ?? {}, null, 2))}>
          📋 Copy Full Output JSON
        </button>
      </div>
    </section>
  </div>
}

function PlanViewer({ plan }) {
  const arch = plan.architecture || {}
  const models = plan.domain_models || []
  const routes = plan.api_contract || []
  const steps = plan.implementation_steps || []

  return <div className="plan-viewer">
    <div className="plan-summary-card">
      <h3>🎯 Strategic Mission Goal</h3>
      <p>{plan.goal || plan.summary}</p>
    </div>

    {/* Architecture Grid */}
    {Object.keys(arch).length > 0 && (
      <div className="section-block">
        <h4>🏛️ System Architecture Overview</h4>
        <div className="arch-grid">
          {arch.frontend && <div className="arch-card"><span className="arch-icon">💻</span><div><strong>Frontend SPA</strong><p>{arch.frontend}</p></div></div>}
          {arch.backend && <div className="arch-card"><span className="arch-icon">⚙️</span><div><strong>Backend API Layer</strong><p>{arch.backend}</p></div></div>}
          {arch.database && <div className="arch-card"><span className="arch-icon">🗄️</span><div><strong>Database & Persistence</strong><p>{arch.database}</p></div></div>}
          {arch.security && <div className="arch-card"><span className="arch-icon">🔒</span><div><strong>Security & Authentication</strong><p>{arch.security}</p></div></div>}
        </div>
      </div>
    )}

    {/* Domain Models & Database Schemas */}
    {models.length > 0 && (
      <div className="section-block">
        <h4>⚡ Synthesized Domain Models & Schemas</h4>
        <div className="models-grid">
          {models.map((model) => (
            <div key={model.name} className="model-card">
              <div className="model-header">
                <strong>{model.name}</strong>
                <span className="badge-type">Entity Model</span>
              </div>
              <table className="fields-table">
                <thead>
                  <tr><th>Field</th><th>Type</th><th>Description</th></tr>
                </thead>
                <tbody>
                  {(model.fields || []).map((f) => (
                    <tr key={f.name}>
                      <td><code>{f.name}</code></td>
                      <td><span className="type-pill">{f.type}</span></td>
                      <td>{f.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* API Contracts */}
    {routes.length > 0 && (
      <div className="section-block">
        <h4>🔌 REST API Specifications</h4>
        <div className="routes-list">
          {routes.map((route, i) => (
            <div key={i} className="route-item">
              <span className={`method-pill ${route.method.toLowerCase()}`}>{route.method}</span>
              <code>{route.path}</code>
              <span className="route-desc">{route.description}</span>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Execution Steps */}
    {steps.length > 0 && (
      <div className="section-block">
        <h4>📋 Implementation Roadmap & Deliverables</h4>
        <div className="roadmap-list">
          {steps.map((st) => (
            <div key={st.step} className="roadmap-step">
              <span className="step-num">{st.step}</span>
              <div>
                <strong>{st.title}</strong>
                <p>{st.detail}</p>
                {st.deliverables?.length > 0 && (
                  <div className="deliverables-tags">
                    {st.deliverables.map((d, idx) => <span key={idx} className="deliv-tag">📦 {d}</span>)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
}

function CodeExplorer({ files, summary, _planUsed, order, result }) {
  const [activeFileIndex, setActiveFileIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const activeFile = files[activeFileIndex] || files[0]

  const copyCode = () => {
    if (!activeFile?.code) return
    navigator.clipboard.writeText(activeFile.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return <div className="code-explorer">
    <div className="code-header-info">
      <div>
        <h3>⚡ Generated Source Code Files</h3>
        <p>{summary || 'Complete software implementation code generated by Coding Agent'}</p>
      </div>
      {result && <div className="result-banner">✨ {result}</div>}
    </div>

    {/* File Tabs */}
    {files.length > 0 ? (
      <div className="code-container">
        <div className="file-tabs">
          {files.map((file, idx) => {
            const fileName = file.path.split('/').pop()
            return (
              <button key={file.path} className={`file-tab ${idx === activeFileIndex ? 'active' : ''}`} onClick={() => setActiveFileIndex(idx)}>
                <span className="file-icon">{file.language === 'python' ? '🐍' : file.language === 'javascript' ? '⚛️' : file.language === 'sql' ? '🗄️' : '📄'}</span>
                <span>{fileName}</span>
              </button>
            )
          })}
        </div>

        {activeFile && (
          <div className="code-viewer-card">
            <div className="code-bar">
              <div className="file-meta">
                <code>{activeFile.path}</code>
                <span className="purpose-text">— {activeFile.purpose}</span>
              </div>
              <button className="copy-code-btn" onClick={copyCode}>
                {copied ? '✅ Copied!' : '📋 Copy Code'}
              </button>
            </div>

            <div className="code-scroll-box">
              <pre className="code-content">
                <code>
                  {activeFile.code ? activeFile.code.split('\n').map((line, i) => (
                    <div key={i} className="code-line">
                      <span className="line-num">{i + 1}</span>
                      <span className="line-text">{line}</span>
                    </div>
                  )) : 'No source code available.'}
                </code>
              </pre>
            </div>
          </div>
        )}
      </div>
    ) : (
      <p className="empty-state">No source code files generated yet.</p>
    )}

    {/* Implementation Order */}
    {order.length > 0 && (
      <div className="section-block" style={{ marginTop: 24 }}>
        <h4>🛠️ Build Order & Engineering Blueprint</h4>
        <div className="roadmap-list">
          {order.map((item) => (
            <div key={item.step} className="roadmap-step">
              <span className="step-num">{item.step}</span>
              <div>
                <strong>{item.area}</strong>
                <p>{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
}
