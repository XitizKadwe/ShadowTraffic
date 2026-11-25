import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileJson2,
  Filter,
  Gauge,
  GitCompareArrows,
  Layers3,
  ListFilter,
  Menu,
  Play,
  Plus,
  Radio,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
  Zap,
} from 'lucide-react'
import { api, jsonBody } from './api.js'

const navItems = [
  { label: 'Overview', icon: Layers3 },
  { label: 'Replay runs', icon: Activity },
  { label: 'Diff inspector', icon: GitCompareArrows },
  { label: 'Captured traffic', icon: Database },
]

function IconButton({ label, children, className = '', onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-[#111720] text-slate-400 transition hover:border-slate-600 hover:text-white ${className}`}
    >
      {children}
    </button>
  )
}

function SectionLabel({ children, action }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {children}
      </h2>
      {action}
    </div>
  )
}

function StatCard({ label, value, change, icon: Icon, tone = 'lime', note }) {
  const tones = {
    lime: 'text-lime-300 bg-lime-300/10',
    blue: 'text-sky-300 bg-sky-300/10',
    violet: 'text-violet-300 bg-violet-300/10',
    amber: 'text-amber-300 bg-amber-300/10',
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-4 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400">{label}</p>
          <p className="mt-2 text-[25px] font-semibold tracking-tight text-slate-100">{value}</p>
        </div>
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon size={17} strokeWidth={1.8} />
        </span>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[11px]">
        {change && <span className="inline-flex items-center gap-0.5 font-medium text-lime-300"><ArrowUpRight size={13} />{change}</span>}
        <span className="text-slate-500">{note}</span>
      </div>
    </div>
  )
}

function TrafficChart({ values = [] }) {
  const max = Math.max(...values, 1)
  const points = Array.from({ length: 24 }, (_, index) => {
    const value = values[index] || 0
    return 46 - (value / max) * 32
  })
  const line = points.map((point, index) => `${(index / (points.length - 1)) * 100},${point}`).join(' ')
  const area = `0,52 ${line} 100,52`

  return (
    <div className="relative h-[112px] overflow-hidden">
      <div className="absolute inset-0 flex flex-col justify-between">
        {[0, 1, 2, 3].map((lineIndex) => <div key={lineIndex} className="border-t border-dashed border-slate-800/80" />)}
      </div>
      <svg viewBox="0 0 100 54" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#a3e635" stopOpacity=".19" />
            <stop offset="100%" stopColor="#a3e635" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#chartFill)" />
        <polyline points={line} fill="none" stroke="#a3e635" strokeWidth=".8" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="absolute right-[18%] top-[25%] h-2 w-2 rounded-full border-2 border-canvas bg-lime-300 shadow-[0_0_12px_rgba(163,230,53,.8)]" />
    </div>
  )
}

function RunRow({ run, selected, onSelect }) {
  const statusStyles = {
    Completed: 'bg-emerald-400/10 text-emerald-300',
    Running: 'bg-sky-400/10 text-sky-300',
    Failed: 'bg-rose-400/10 text-rose-300',
    Queued: 'bg-amber-400/10 text-amber-200',
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`grid w-full grid-cols-[minmax(190px,1.8fr)_minmax(100px,.8fr)_90px_74px_72px_78px] items-center gap-3 border-b border-line/80 px-4 py-3.5 text-left transition last:border-0 hover:bg-white/[0.025] ${selected ? 'bg-lime-300/[0.045]' : ''}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${run.status === 'Running' ? 'animate-pulse bg-sky-300' : run.status === 'Queued' ? 'bg-amber-300' : run.status === 'Failed' ? 'bg-rose-300' : 'bg-emerald-300'}`} />
          <span className="truncate text-[12px] font-medium text-slate-200">{run.name}</span>
        </div>
        <span className="mono ml-3.5 text-[10px] text-slate-500">{run.id}</span>
      </div>
      <span className="text-[11px] text-slate-400">{Number(run.requests || 0).toLocaleString()} <span className="text-slate-600">req</span></span>
      <span className={`w-fit rounded-md px-2 py-1 text-[10px] font-medium ${statusStyles[run.status] || statusStyles.Queued}`}>{run.status}</span>
      <span className={`text-xs font-medium ${run.diffs > 100 ? 'text-rose-300' : run.diffs > 0 ? 'text-amber-300' : 'text-slate-400'}`}>{run.rate}</span>
      <span className="text-xs text-slate-300">{run.p95}</span>
      <span className="text-right text-[10px] text-slate-500">{run.time}</span>
    </button>
  )
}

function pretty(value) {
  return JSON.stringify(value ?? null, null, 2)
}

function prettyDifference(value) {
  return value === '[missing]' ? value : pretty(value)
}

function DiffInspector({ run, detail, results = [], onSelectResult, onCopyRequestId, onClose, onSave, saving }) {
  const [activeTab, setActiveTab] = useState('Diffs')
  const differences = detail?.differences || []
  const tabs = ['Diffs', 'Request', 'Responses']

  return (
    <aside className="flex min-h-[570px] flex-col overflow-hidden rounded-xl border border-line bg-panel xl:sticky xl:top-5 xl:max-h-[calc(100vh-40px)]">
      <div className="flex items-start justify-between border-b border-line px-4 py-4">
        <div>
          <div className="flex items-center gap-2">
            <GitCompareArrows size={15} className="text-lime-300" />
            <h2 className="text-sm font-semibold text-slate-100">Diff inspector</h2>
          </div>
          <p className="mono mt-1.5 text-[10px] text-slate-500">{run?.id || 'Select a replay run'}</p>
        </div>
        <div className="flex items-center gap-2">
          <IconButton label="Copy request ID" onClick={onCopyRequestId}><Copy size={14} /></IconButton>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-white/5 hover:text-white xl:hidden" aria-label="Close inspector"><X size={15} /></button>
        </div>
      </div>

      <div className="space-y-4 overflow-y-auto p-4 scrollbar-hidden">
        {detail ? <div className="rounded-lg border border-line bg-[#0c1118] p-3">
          <label className="mb-3 block">
            <span className="mb-1.5 block text-[9px] uppercase tracking-wider text-slate-600">Captured request</span>
            <select aria-label="Choose captured request" value={detail.id} onChange={(event) => onSelectResult(Number(event.target.value))} className="w-full truncate rounded-md border border-line bg-[#111720] px-2 py-2 text-[10px] text-slate-300 outline-none focus:border-lime-300/50">
              {results.map((result) => <option key={result.id} value={result.id}>{result.service} · {result.method} {result.path}{result.has_diff ? ' · DIFF' : ''}</option>)}
            </select>
          </label>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="mono rounded bg-sky-300/10 px-1.5 py-1 text-[9px] font-medium text-sky-300">{detail.method}</span>
              <span className="mono truncate text-[10px] text-slate-300">{detail.path}</span>
            </div>
            <ExternalLink size={13} className="shrink-0 text-slate-600" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line/70 pt-3">
            <div><p className="text-[9px] uppercase tracking-wider text-slate-600">Request ID</p><p className="mono mt-1 truncate text-[10px] text-slate-400">{detail.requestId}</p></div>
            <div><p className="text-[9px] uppercase tracking-wider text-slate-600">Difference type</p><p className="mt-1 text-[10px] text-slate-300">{detail.diffType}</p></div>
          </div>
        </div> : <div className="rounded-lg border border-dashed border-line p-6 text-center text-xs text-slate-500">Run a replay to inspect recorded request and response pairs.</div>}

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-line bg-[#0c1118] px-3 py-2.5">
            <p className="text-[9px] uppercase tracking-wider text-slate-600">Baseline · v1</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-300"><span className="h-1.5 w-1.5 rounded-full bg-slate-500" />{detail ? `${detail.baseline_latency_ms} ms` : 'Local demo'}</p>
          </div>
          <div className="rounded-lg border border-lime-300/15 bg-lime-300/[0.035] px-3 py-2.5">
            <p className="text-[9px] uppercase tracking-wider text-slate-600">Candidate · v2</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-300"><span className="h-1.5 w-1.5 rounded-full bg-lime-300" />{detail ? `${detail.candidate_latency_ms} ms` : 'Local demo'}</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <SectionLabel action={<span className="rounded-full bg-amber-300/10 px-2 py-1 text-[9px] font-medium text-amber-200">{differences.length ? `${differences.length} differences` : 'No diffs'}</span>}>Request detail</SectionLabel>
          </div>
          <div className="mb-3 flex rounded-lg border border-line bg-[#0c1118] p-1">
            {tabs.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 rounded-md py-1.5 text-[10px] transition ${activeTab === tab ? 'bg-[#202936] text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}>{tab}</button>
            ))}
          </div>
          {activeTab === 'Diffs' && <div className="space-y-2">
            {differences.map((diff) => (
              <div key={diff.path} className="overflow-hidden rounded-lg border border-line bg-[#0c1118]">
                <div className="flex items-center justify-between gap-2 border-b border-line/70 px-2.5 py-2">
                  <span className="mono truncate text-[9px] text-slate-400">{diff.path}</span>
                  <span className="shrink-0 text-[8px] text-amber-200/80">{diff.kind}</span>
                </div>
                <div className="grid grid-cols-2">
                  <div className="border-r border-line/70 bg-rose-400/[0.045] px-2.5 py-2">
                    <p className="mb-1 text-[8px] uppercase text-slate-600">v1</p>
                    <pre className="mono max-h-24 overflow-auto whitespace-pre-wrap break-all text-[10px] text-rose-200/80">{prettyDifference(diff.old_value)}</pre>
                  </div>
                  <div className="bg-lime-300/[0.035] px-2.5 py-2">
                    <p className="mb-1 text-[8px] uppercase text-slate-600">v2</p>
                    <pre className="mono max-h-24 overflow-auto whitespace-pre-wrap break-all text-[10px] text-lime-200/90">{prettyDifference(diff.new_value)}</pre>
                  </div>
                </div>
              </div>
            ))}
            {detail && !differences.length && (
              <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center">
                <Check size={18} className="mx-auto text-emerald-300" />
                <p className="mt-2 text-xs font-medium text-slate-300">Responses match</p>
                <p className="mt-1 text-[10px] text-slate-500">No differences found for this run.</p>
              </div>
            )}
          </div>}
          {activeTab === 'Request' && <pre className="max-h-64 overflow-auto rounded-lg border border-line bg-[#0c1118] p-3 text-[9px] leading-relaxed text-slate-300">{pretty({ method: detail?.method, path: detail?.path, query: detail?.query, body: detail?.body })}</pre>}
          {activeTab === 'Responses' && <div className="grid gap-2">
            <pre className="max-h-52 overflow-auto rounded-lg border border-line bg-[#0c1118] p-3 text-[9px] leading-relaxed text-slate-300">v1 · {pretty(detail?.baseline)}</pre>
            <pre className="max-h-52 overflow-auto rounded-lg border border-lime-300/15 bg-[#0c1118] p-3 text-[9px] leading-relaxed text-slate-300">v2 · {pretty(detail?.candidate)}</pre>
          </div>}
        </div>
      </div>
      <div className="mt-auto border-t border-line p-3">
        <button type="button" onClick={onSave} disabled={!detail?.has_diff || saving} className="flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-[#151c26] py-2.5 text-[11px] font-medium text-slate-300 transition hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">
          <FileJson2 size={14} /> {saving ? 'Saving regression…' : 'Save as regression case'}
        </button>
      </div>
    </aside>
  )
}

function Field({ label, children }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-medium text-slate-400">{label}</span>{children}</label>
}

const fieldClass = 'w-full rounded-lg border border-line bg-[#0b1017] px-3 py-2.5 text-xs text-slate-200 outline-none transition focus:border-lime-300/50'

function ReplayModal({ onClose, onCreate, capturedCount }) {
  const [name, setName] = useState('manual-shadow-replay')
  const [requestLimit, setRequestLimit] = useState(Math.min(capturedCount, 50))
  const [concurrency, setConcurrency] = useState(2)
  const [created, setCreated] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      setCreated(await onCreate({ name, request_limit: Number(requestLimit), concurrency: Number(concurrency) }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <form onSubmit={submit} className="w-full max-w-[440px] rounded-2xl border border-line bg-[#10151e] p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-lime-300/10 text-lime-300"><Play size={16} /></div>
            <h2 className="mt-3 text-base font-semibold text-white">Create a replay</h2>
            <p className="mt-1 text-xs text-slate-500">Compare captured requests against local v1 and v2 demo services.</p>
          </div>
          <IconButton label="Close dialog" onClick={onClose}><X size={15} /></IconButton>
        </div>
        {created ? (
          <div className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4">
            <p className="text-xs font-medium text-emerald-100">Replay queued</p>
            <p className="mono mt-1 text-[10px] text-slate-400">{created.id}</p>
            <button type="button" onClick={onClose} className="mt-3 text-[11px] font-medium text-lime-300 hover:text-lime-200">Close</button>
          </div>
        ) : (
          <>
            <div className="mt-5 space-y-3">
              <Field label="Replay name"><input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={`Captured requests (available: ${capturedCount})`}><input type="number" min="1" max={Math.min(capturedCount, 100)} value={requestLimit} onChange={(event) => setRequestLimit(event.target.value)} className={fieldClass} /></Field>
                <Field label="Concurrency (max 4)"><select value={concurrency} onChange={(event) => setConcurrency(event.target.value)} className={fieldClass}><option value="1">1 worker</option><option value="2">2 workers</option><option value="3">3 workers</option><option value="4">4 workers</option></select></Field>
              </div>
              <div className="rounded-lg border border-amber-300/15 bg-amber-300/[0.045] p-3 text-[10px] leading-relaxed text-slate-400">
                This build replays only to its two loopback demo services. Captured payloads are redacted before storage.
              </div>
            </div>
            {error && <p role="alert" className="mt-3 text-[10px] text-rose-300">{error}</p>}
            <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
              <span className="flex items-center gap-1.5 text-[10px] text-slate-500"><ShieldCheck size={13} /> Loopback targets only</span>
              <button disabled={busy || capturedCount === 0} type="submit" className="inline-flex items-center gap-2 rounded-lg bg-lime-300 px-3.5 py-2.5 text-[11px] font-semibold text-[#151a11] transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50"><Play size={13} fill="currentColor" /> {busy ? 'Queueing…' : 'Start replay'}</button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}

function CaptureModal({ onClose, onCapture }) {
  const [service, setService] = useState('checkout-service')
  const [method, setMethod] = useState('POST')
  const [path, setPath] = useState('/api/v1/checkout')
  const [query, setQuery] = useState('{}')
  const [body, setBody] = useState('{\n  "amount": 128.5,\n  "coupon_code": null,\n  "customer_type": "GOV_PSU",\n  "tax": 10.28\n}')
  const [batchMode, setBatchMode] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  let bodyIsArray = false
  try {
    bodyIsArray = Array.isArray(JSON.parse(body))
  } catch {
    bodyIsArray = false
  }

  function updateBody(value) {
    setBody(value)
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        setBatchMode(true)
        const checkoutBatch = parsed.length > 0 && parsed.every((item) => (
          item && typeof item === 'object' && !Array.isArray(item)
          && 'amount' in item && 'customer_type' in item
        ))
        if (checkoutBatch) {
          setService('checkout-service')
          setMethod('POST')
          setPath('/api/v1/checkout')
        }
      } else if (parsed && typeof parsed === 'object' && ('ticket_id' in parsed || 'ward' in parsed)) {
        setBatchMode(false)
        setService('citizen-complaints')
        setMethod('POST')
        setPath('/api/v1/complaints')
      }
    } catch {
      setError('')
    }
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    try {
      const parsedBody = body.trim() ? JSON.parse(body) : null
      const request = {
        service,
        method,
        path,
        query: JSON.parse(query),
        headers: { 'content-type': 'application/json' },
        body: parsedBody,
        batch: Array.isArray(parsedBody) && batchMode,
        source: 'dashboard',
      }
      setBusy(true)
      await onCapture(request)
      onClose()
    } catch (requestError) {
      setError(requestError instanceof SyntaxError ? `Invalid JSON: ${requestError.message}` : requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <form onSubmit={submit} className="w-full max-w-[560px] rounded-2xl border border-line bg-[#10151e] p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-300/10 text-sky-300"><Upload size={16} /></div>
            <h2 className="mt-3 text-base font-semibold text-white">Record a request</h2>
            <p className="mt-1 text-xs text-slate-500">Store a sanitized HTTP request for local shadow replay.</p>
          </div>
          <IconButton label="Close dialog" onClick={onClose}><X size={15} /></IconButton>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Field label="Service"><input required value={service} onChange={(event) => setService(event.target.value)} className={fieldClass} /></Field>
          <Field label="Method"><select value={method} onChange={(event) => setMethod(event.target.value)} className={fieldClass}>{['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((value) => <option key={value}>{value}</option>)}</select></Field>
          <div className="col-span-2"><Field label="Relative path"><input required value={path} onChange={(event) => setPath(event.target.value)} placeholder="/api/v1/checkout" className={fieldClass} /></Field></div>
          <div className="col-span-2"><Field label="Query JSON"><input value={query} onChange={(event) => setQuery(event.target.value)} className={`${fieldClass} mono`} /></Field></div>
          <div className="col-span-2"><Field label="Request body JSON"><textarea value={body} onChange={(event) => updateBody(event.target.value)} rows={6} className={`${fieldClass} mono resize-y`} /></Field></div>
        </div>
        {bodyIsArray && <label className="mt-3 flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={batchMode} onChange={(event) => setBatchMode(event.target.checked)} className="accent-lime-300" />Treat each top-level array item as a separate request</label>}
        <p className="mt-2 text-[9px] leading-relaxed text-slate-500">Authorization, cookies, tokens, names, locations, email, phone and payment-card fields are excluded or redacted before storage. Recognized checkout batches and complaint payloads select their local demo route automatically.</p>
        {error && <p role="alert" className="mt-3 text-[10px] text-rose-300">{error}</p>}
        <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
          <span className="text-[10px] text-slate-500">Max JSON body: 256 KB</span>
          <button disabled={busy} type="submit" className="inline-flex items-center gap-2 rounded-lg bg-lime-300 px-3.5 py-2.5 text-[11px] font-semibold text-[#151a11] transition hover:bg-lime-200 disabled:opacity-50"><Upload size={13} /> {busy ? 'Recording…' : `Record ${bodyIsArray && batchMode ? 'batch' : 'request'}`}</button>
        </div>
      </form>
    </div>
  )
}

function SettingsModal({ refreshInterval, onRefreshIntervalChange, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="w-full max-w-[420px] rounded-2xl border border-line bg-[#10151e] p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-300/10 text-violet-300"><Settings2 size={16} /></div>
            <h2 className="mt-3 text-base font-semibold text-white">Dashboard settings</h2>
            <p className="mt-1 text-xs text-slate-500">Control live refresh for this browser session.</p>
          </div>
          <IconButton label="Close settings" onClick={onClose}><X size={15} /></IconButton>
        </div>
        <div className="mt-5">
          <Field label="Refresh dashboard data">
            <select value={refreshInterval} onChange={(event) => onRefreshIntervalChange(Number(event.target.value))} className={fieldClass}>
              <option value="0">Off</option>
              <option value="2500">Every 2.5 seconds</option>
              <option value="5000">Every 5 seconds</option>
              <option value="15000">Every 15 seconds</option>
            </select>
          </Field>
          <div className="mt-4 rounded-lg border border-line bg-[#0c1118] p-3 text-[10px] leading-relaxed text-slate-400">
            Replays stay on the local demo services. This dashboard does not connect to or send captured traffic to production.
          </div>
        </div>
        <div className="mt-5 flex justify-end border-t border-line pt-4">
          <button type="button" onClick={onClose} className="rounded-lg bg-lime-300 px-4 py-2 text-[11px] font-semibold text-[#151a11] hover:bg-lime-200">Done</button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [runs, setRuns] = useState([])
  const [summary, setSummary] = useState(null)
  const [traffic, setTraffic] = useState({ total: 0, items: [] })
  const [selectedRunId, setSelectedRunId] = useState('')
  const [selectedDiffId, setSelectedDiffId] = useState(null)
  const [runDetail, setRunDetail] = useState(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All runs')
  const [replayFilter, setReplayFilter] = useState('All requests')
  const [activeNav, setActiveNav] = useState('Overview')
  const [replayOpen, setReplayOpen] = useState(false)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(2500)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [savingCase, setSavingCase] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadData = useCallback(async () => {
    try {
      const [summaryData, runData, trafficData] = await Promise.all([
        api('/summary'),
        api('/runs'),
        api('/traffic?limit=8'),
      ])
      setSummary(summaryData)
      setRuns(runData.items)
      setTraffic(trafficData)
      setError('')
      setSelectedRunId((selected) => selected || runData.items[0]?.id || '')
    } catch (requestError) {
      setError(requestError.message)
    }
  }, [])

  useEffect(() => {
    loadData()
    if (!refreshInterval) return undefined
    const timer = window.setInterval(loadData, refreshInterval)
    return () => window.clearInterval(timer)
  }, [loadData, refreshInterval])

  useEffect(() => {
    if (!selectedRunId) {
      setRunDetail(null)
      return undefined
    }
    let active = true
    api(`/runs/${encodeURIComponent(selectedRunId)}`)
      .then((detail) => { if (active) setRunDetail(detail) })
      .catch((requestError) => { if (active) setError(requestError.message) })
    return () => { active = false }
  }, [selectedRunId, runs])

  const filteredRuns = useMemo(() => runs.filter((run) => {
    const matchesQuery = `${run.name} ${run.id} ${run.source} ${run.target}`.toLowerCase().includes(query.toLowerCase())
    const matchesStatus = statusFilter === 'All runs' || run.status === statusFilter
    const matchesReplayFilter = replayFilter === 'All requests'
      || (replayFilter === 'With differences' && run.diffs > 0)
      || (replayFilter === 'With errors' && run.error_count > 0)
    return matchesQuery && matchesStatus && matchesReplayFilter
  }), [runs, query, statusFilter, replayFilter])
  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? null
  const selectedDetail = runDetail?.results?.find((item) => item.id === selectedDiffId)
    ?? runDetail?.results?.find((item) => item.has_diff)
    ?? runDetail?.results?.[0]
    ?? null
  const activeRuns = runs.filter((run) => run.status === 'Running' || run.status === 'Queued').length

  function chooseNav(label) {
    setActiveNav(label)
    setMobileNavOpen(false)
    if (label === 'Diff inspector') setInspectorOpen(true)
    if (label === 'Replay runs') document.getElementById('runs-table')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (label === 'Captured traffic') document.getElementById('captured-traffic')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (label === 'Overview') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function createReplay(payload) {
    const run = await api('/runs', { method: 'POST', body: jsonBody(payload) })
    setSelectedRunId(run.id)
    setSelectedDiffId(null)
    setInspectorOpen(true)
    setNotice(`Replay ${run.id} was queued.`)
    await loadData()
    return run
  }

  async function recordTraffic(payload) {
    const result = await api('/traffic', { method: 'POST', body: jsonBody(payload) })
    setNotice(`${result.created} ${result.created === 1 ? 'request' : 'requests'} recorded. Sensitive fields were redacted before storage.`)
    await loadData()
  }

  async function saveRegression() {
    if (!selectedRunId || !selectedDetail?.has_diff) return
    setSavingCase(true)
    try {
      const result = await api(`/regressions/from-run/${encodeURIComponent(selectedRunId)}`, {
        method: 'POST',
        body: jsonBody({ diff_ids: [selectedDetail.id] }),
      })
      setNotice(result.created ? 'Regression case saved.' : 'This difference was already saved as a regression case.')
      await loadData()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSavingCase(false)
    }
  }

  async function copyRequestId() {
    if (!selectedDetail?.requestId) {
      setNotice('Select a replay request before copying its ID.')
      return
    }
    try {
      await navigator.clipboard.writeText(selectedDetail.requestId)
      setNotice(`Copied request ID ${selectedDetail.requestId}.`)
    } catch {
      setError('Clipboard access was denied by the browser. Select and copy the request ID manually.')
    }
  }

  function selectRun(run) {
    setSelectedRunId(run.id)
    setSelectedDiffId(null)
    setInspectorOpen(true)
  }

  return (
    <div className="min-h-screen text-slate-200">
      <header className="sticky top-0 z-30 flex h-[62px] items-center justify-between border-b border-line/90 bg-[#0a0e15]/95 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setMobileNavOpen(true)} className="mr-1 rounded-md p-1.5 text-slate-400 hover:bg-white/5 lg:hidden" aria-label="Open menu"><Menu size={18} /></button>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-lime-300/20 bg-lime-300/[0.08] text-lime-300"><Radio size={17} /></div>
          <div className="flex items-baseline gap-2">
            <span className="text-[14px] font-semibold tracking-tight text-slate-100">shadow<span className="text-lime-300">traffic</span></span>
            <span className="hidden text-[10px] text-slate-600 sm:inline">CONTROL CENTER</span>
          </div>
          <span className="ml-1 hidden h-4 border-l border-line sm:block" />
          <span className="hidden items-center gap-2 px-2 py-1.5 text-[11px] text-slate-400 sm:inline-flex"><Box size={13} /> Local workspace</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden items-center gap-1.5 rounded-md border border-amber-300/15 bg-amber-300/[0.06] px-2 py-1.5 text-[9px] font-medium uppercase tracking-wide text-amber-200 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> Local demo</span>
          <div className="relative">
            <button type="button" onClick={() => setNotificationsOpen((open) => !open)} className="relative rounded-md p-2 text-slate-500 transition hover:bg-white/5 hover:text-slate-200" aria-label="Notifications" aria-expanded={notificationsOpen}><Bell size={16} />{activeRuns > 0 && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-lime-300" />}</button>
            {notificationsOpen && <div className="absolute right-0 top-11 z-40 w-[min(320px,calc(100vw-24px))] rounded-xl border border-line bg-[#10151e] p-3 shadow-2xl">
              <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-slate-200">Replay activity</span><button type="button" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications" className="text-slate-500 hover:text-white"><X size={13} /></button></div>
              {runs.slice(0, 4).map((run) => <button key={run.id} type="button" onClick={() => { setSelectedRunId(run.id); setSelectedDiffId(null); setInspectorOpen(true); setNotificationsOpen(false) }} className="flex w-full items-start gap-2 border-t border-line py-2 text-left hover:bg-white/[0.03]">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${run.status === 'Failed' || run.error_count ? 'bg-rose-300' : run.status === 'Running' || run.status === 'Queued' ? 'bg-sky-300' : 'bg-emerald-300'}`} />
                <span className="min-w-0"><span className="block truncate text-[10px] text-slate-300">{run.name}</span><span className="block text-[9px] text-slate-600">{run.status} · {run.diffs} differences · {run.time}</span></span>
              </button>)}
              {!runs.length && <p className="py-4 text-center text-[10px] text-slate-500">No replay activity yet.</p>}
            </div>}
          </div>
          <a href="/docs" target="_blank" rel="noreferrer" aria-label="Help and API docs" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-[#111720] text-slate-400 transition hover:border-slate-600 hover:text-white"><CircleHelp size={15} /></a>
          <div className="ml-1 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-[#202936] text-[10px] font-medium text-slate-300">KT</div>
        </div>
      </header>

      {mobileNavOpen && <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileNavOpen(false) }}>
        <nav className="h-full w-[280px] border-r border-line bg-[#0d1219] px-4 py-4 shadow-2xl">
          <div className="mb-5 flex items-center justify-between"><span className="text-sm font-semibold text-slate-100">Workspace menu</span><IconButton label="Close menu" onClick={() => setMobileNavOpen(false)}><X size={15} /></IconButton></div>
          <div className="space-y-1">
            {navItems.map(({ label, icon: Icon }) => <button key={label} type="button" onClick={() => chooseNav(label)} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-3 text-left text-xs ${activeNav === label ? 'bg-lime-300/[0.09] font-medium text-lime-200' : 'text-slate-400 hover:bg-white/[0.035] hover:text-white'}`}><Icon size={15} />{label}</button>)}
          </div>
          <div className="mt-8 border-t border-line pt-4">
            <p className="mb-2 px-2 text-[9px] font-semibold uppercase tracking-wider text-slate-600">Environments · read only</p>
            <p className="px-2 py-2 text-[10px] text-slate-400">● Local demo v1</p>
            <p className="px-2 py-2 text-[10px] text-lime-300">● Local demo v2</p>
          </div>
          <button type="button" onClick={() => { setMobileNavOpen(false); setSettingsOpen(true) }} className="mt-4 flex w-full items-center gap-2 rounded-lg px-2.5 py-3 text-left text-xs text-slate-400 hover:bg-white/[0.035] hover:text-white"><Settings2 size={15} /> Settings</button>
          <a href="/api/regressions/export" className="mt-2 flex w-full items-center gap-2 rounded-lg px-2.5 py-3 text-xs text-slate-400 hover:bg-white/[0.035] hover:text-white"><Download size={15} /> Export pytest regression tests</a>
          <a href="/api/regressions/export?format=json" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-3 text-xs text-slate-400 hover:bg-white/[0.035] hover:text-white"><FileJson2 size={15} /> Export regression JSON</a>
        </nav>
      </div>}

      <div className="mx-auto flex max-w-[1600px]">
        <nav className="sticky top-[62px] hidden h-[calc(100vh-62px)] w-[210px] shrink-0 flex-col border-r border-line/80 px-3 py-5 lg:flex">
          <p className="mb-2 px-2 text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-600">Workspace</p>
          <div className="space-y-1">
            {navItems.map(({ label, icon: Icon }) => (
              <button key={label} type="button" onClick={() => chooseNav(label)} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-[11px] transition ${activeNav === label ? 'bg-lime-300/[0.09] font-medium text-lime-200' : 'text-slate-500 hover:bg-white/[0.035] hover:text-slate-300'}`}>
                <Icon size={15} strokeWidth={1.8} />{label}{label === 'Captured traffic' && <span className="ml-auto rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-slate-500">{traffic.total}</span>}
              </button>
            ))}
          </div>
          <div className="mb-2 mt-8 flex items-center justify-between px-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-600">Environments</p>
            <span className="text-[9px] text-slate-700">fixed</span>
          </div>
          <div className="space-y-1">
            {[['Local demo · v1', 'bg-emerald-300'], ['Local demo · v2', 'bg-lime-300']].map(([label, dot]) => (
              <div key={label} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[10px] text-slate-500"><span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{label}</div>
            ))}
          </div>
          <div className="mt-auto rounded-xl border border-line bg-[#10151e] p-3">
            <div className="flex items-center gap-2 text-slate-300"><Sparkles size={14} className="text-lime-300" /><span className="text-[10px] font-medium">Replay insights</span></div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">Catch behavior changes before they reach production.</p>
            <a href="/docs" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[10px] font-medium text-lime-300 hover:text-lime-200">Explore API docs <ArrowUpRight size={11} /></a>
          </div>
          <button type="button" onClick={() => setSettingsOpen(true)} className="mt-3 flex items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] text-slate-500 hover:bg-white/[0.035] hover:text-slate-300"><Settings2 size={14} /> Settings</button>
        </nav>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-7 lg:py-7">
          <div className="mx-auto max-w-[1320px]">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2 text-[10px] text-slate-500"><span>Workspace</span><ChevronRight size={11} /><span className="text-slate-400">{activeNav}</span></div>
                <h1 className="text-[22px] font-semibold tracking-tight text-slate-100 sm:text-[25px]">Replay control center</h1>
                <p className="mt-1.5 text-xs text-slate-500">Capture sanitized requests, compare v1 and v2, and save regressions.</p>
              </div>
              <div className="flex items-center gap-2">
                <a href="/api/regressions/export" className="hidden items-center gap-2 rounded-lg border border-line bg-[#111720] px-3 py-2.5 text-[10px] text-slate-400 transition hover:border-slate-600 hover:text-slate-200 sm:flex"><Download size={13} /> Export pytest</a>
                <a href="/api/regressions/export?format=json" className="hidden items-center gap-2 rounded-lg border border-line bg-[#111720] px-3 py-2.5 text-[10px] text-slate-400 transition hover:border-slate-600 hover:text-slate-200 sm:flex"><FileJson2 size={13} /> Export JSON</a>
                <button type="button" onClick={() => setCaptureOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-line bg-[#111720] px-3 py-2.5 text-[10px] text-slate-300 transition hover:border-slate-600 hover:text-white"><Upload size={13} /> Record traffic</button>
                <button type="button" onClick={() => setReplayOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-lime-300 px-3.5 py-2.5 text-[11px] font-semibold text-[#151a11] shadow-[0_4px_14px_rgba(163,230,53,0.12)] transition hover:bg-lime-200"><Plus size={14} strokeWidth={2.5} /> New replay</button>
              </div>
            </div>

            {error && <div role="alert" className="mb-4 flex items-center justify-between rounded-lg border border-rose-300/20 bg-rose-300/[0.06] px-3 py-2.5 text-[11px] text-rose-200"><span>API error: {error}</span><button type="button" onClick={loadData} className="text-rose-100 underline">Retry</button></div>}
            {notice && <div role="status" className="mb-4 flex items-center justify-between rounded-lg border border-emerald-300/20 bg-emerald-300/[0.05] px-3 py-2.5 text-[11px] text-emerald-200"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={13} /></button></div>}

            <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard label="Requests replayed" value={(summary?.total_requests || 0).toLocaleString()} note="persisted replay results" icon={Activity} tone="lime" />
              <StatCard label="Diff rate" value={`${summary?.diff_rate || 0}%`} note={`${(summary?.diff_count || 0).toLocaleString()} response differences` } icon={GitCompareArrows} tone="blue" />
              <StatCard label="P95 candidate latency" value={summary?.p95_latency_ms == null ? '—' : `${Math.round(summary.p95_latency_ms)} ms`} note={summary?.baseline_p95_latency_ms == null ? 'measured over replayed requests' : `v1 baseline: ${Math.round(summary.baseline_p95_latency_ms)} ms`} icon={Gauge} tone="violet" />
              <StatCard label="Active replays" value={String(activeRuns)} note={`${traffic.total.toLocaleString()} captured requests`} icon={Zap} tone="amber" />
            </div>

            <div className="mb-5 grid gap-3 xl:grid-cols-[minmax(0,1.65fr)_minmax(260px,.75fr)]">
              <section className="overflow-hidden rounded-xl border border-line bg-panel">
                <div className="flex items-start justify-between px-4 pb-0 pt-4">
                  <div>
                    <SectionLabel>Replay volume</SectionLabel>
                    <div className="flex items-baseline gap-2"><span className="text-[20px] font-semibold tracking-tight text-slate-100">{(summary?.total_requests || 0).toLocaleString()}</span><span className="text-[10px] text-slate-500">replayed requests</span></div>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[9px] text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-lime-300" /> requests per hour</div>
                </div>
                <div className="grid-bg mt-1 px-4 pt-3"><TrafficChart values={summary?.hourly_requests || []} /></div>
                <div className="flex justify-between px-4 pb-3 text-[9px] text-slate-600"><span>00:00</span><span>04:00</span><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span><span>Now</span></div>
              </section>

              <section className="rounded-xl border border-line bg-panel p-4">
                <SectionLabel>Top services by diff rate</SectionLabel>
                <div className="space-y-4 pt-1">
                  {(summary?.services || []).map((service) => (
                    <div key={service.name}>
                      <div className="mb-1.5 flex items-center justify-between"><span className="text-[10px] text-slate-300">{service.name}</span><span className={`mono text-[10px] ${service.rate > 1 ? 'text-rose-300' : service.rate > 0 ? 'text-amber-200' : 'text-emerald-300'}`}>{service.rate.toFixed(2)}%</span></div>
                      <div className="h-1 overflow-hidden rounded-full bg-[#202936]"><div className={`h-full rounded-full ${service.rate > 1 ? 'bg-rose-300' : service.rate > 0 ? 'bg-amber-300' : 'bg-emerald-300'}`} style={{ width: `${Math.min(100, Math.max(4, service.rate * 20))}%` }} /></div>
                    </div>
                  ))}
                  {!summary?.services?.length && <p className="py-6 text-center text-[10px] text-slate-600">Run a replay to see service diff rates.</p>}
                </div>
                <button type="button" onClick={() => { setStatusFilter('All runs'); setReplayFilter('With differences'); document.getElementById('runs-table')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }} className="mt-4 flex items-center gap-1 text-[10px] font-medium text-slate-500 transition hover:text-lime-300">View runs with differences <ArrowDownRight size={12} /></button>
              </section>
            </div>

            <section id="runs-table" className="rounded-xl border border-line bg-panel">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xs font-semibold text-slate-200">Recent replay runs</h2>
                  <span className="rounded-md border border-line bg-[#0c1118] px-1.5 py-0.5 text-[9px] text-slate-500">{filteredRuns.length}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex h-8 items-center gap-2 rounded-lg border border-line bg-[#0c1118] px-2.5 text-slate-500 focus-within:border-slate-600">
                    <Search size={13} />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search runs..." className="w-[110px] bg-transparent text-[10px] text-slate-200 outline-none placeholder:text-slate-600 sm:w-[145px]" />
                  </label>
                  <label className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-[#0c1118] px-2 text-slate-400">
                    <Filter size={12} />
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter runs by status" className="max-w-[90px] bg-transparent text-[10px] outline-none sm:max-w-none">
                      <option>All runs</option><option>Queued</option><option>Running</option><option>Completed</option><option>Failed</option>
                    </select>
                    <ChevronDown size={10} />
                  </label>
                  <div className="relative">
                    <IconButton label="More filters" className="h-8 w-8" onClick={() => setFiltersOpen((open) => !open)}><ListFilter size={13} /></IconButton>
                    {filtersOpen && <div className="absolute right-0 top-10 z-20 w-44 rounded-lg border border-line bg-[#10151e] p-1.5 shadow-xl">
                      {['All requests', 'With differences', 'With errors'].map((filter) => <button key={filter} type="button" onClick={() => { setReplayFilter(filter); setFiltersOpen(false) }} className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[10px] ${replayFilter === filter ? 'bg-lime-300/10 text-lime-200' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'}`}>{filter}{replayFilter === filter && <Check size={12} />}</button>)}
                    </div>}
                  </div>
                </div>
              </div>
              <div className="scrollbar-hidden overflow-x-auto">
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-[minmax(190px,1.8fr)_minmax(100px,.8fr)_90px_74px_72px_78px] items-center gap-3 border-b border-line bg-[#0d1219]/70 px-4 py-2.5 text-[9px] font-medium uppercase tracking-wider text-slate-600">
                    <span>Replay</span><span>Requests</span><span>Status</span><span>Diff rate</span><span>P95</span><span className="text-right">Started</span>
                  </div>
                  {filteredRuns.map((run) => <RunRow key={run.id} run={run} selected={selectedRunId === run.id} onSelect={() => selectRun(run)} />)}
                  {filteredRuns.length === 0 && <div className="px-4 py-10 text-center text-xs text-slate-500">No replay runs match your search.</div>}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
                <p className="text-[9px] text-slate-600">Showing <span className="text-slate-400">{filteredRuns.length}</span> of {runs.length} loaded runs</p>
                <span className="text-[9px] text-slate-600">Updated automatically</span>
              </div>
            </section>

            <section id="captured-traffic" className="mt-4 rounded-xl border border-line bg-panel">
              <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                <h2 className="text-xs font-semibold text-slate-200">Captured traffic</h2>
                <span className="rounded-md border border-line bg-[#0c1118] px-1.5 py-0.5 text-[9px] text-slate-500">{traffic.total}</span>
                </div>
                <button type="button" onClick={() => setCaptureOpen(true)} className="inline-flex items-center gap-1.5 text-[10px] font-medium text-lime-300 hover:text-lime-200"><Plus size={12} /> Add a request</button>
              </div>
              <div className="divide-y divide-line/70">
                {traffic.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="mono rounded bg-sky-300/10 px-1.5 py-1 text-[9px] text-sky-300">{item.method}</span>
                    <span className="truncate text-[10px] text-slate-300">{item.service}</span>
                    <span className="mono truncate text-[9px] text-slate-600">{item.path}</span>
                  </div>
                  <span className="shrink-0 text-[9px] text-slate-600">{item.source}</span>
                </div>
                ))}
                {!traffic.items.length && <p className="px-4 py-6 text-center text-[10px] text-slate-600">No captured requests yet.</p>}
              </div>
            </section>

            <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 pb-2 text-[9px] text-slate-700">
              <span className="flex items-center gap-1.5"><Database size={11} /> ShadowTraffic · local demo mode</span>
              <a href="/docs" className="hover:text-slate-400">API documentation</a>
            </footer>
          </div>
        </main>

        <div className={`${inspectorOpen ? 'block' : 'hidden'} fixed inset-0 z-40 bg-black/50 p-3 pt-[74px] backdrop-blur-sm xl:static xl:z-auto xl:block xl:bg-transparent xl:p-5 xl:pl-0 xl:pt-5 xl:backdrop-blur-none`}><div className="mx-auto max-w-[520px] xl:sticky xl:top-[82px] xl:w-[340px]"><DiffInspector run={selectedRun} detail={selectedDetail} results={runDetail?.results || []} onSelectResult={setSelectedDiffId} onCopyRequestId={copyRequestId} onClose={() => setInspectorOpen(false)} onSave={saveRegression} saving={savingCase} /></div></div>
      </div>

      {!inspectorOpen && (
        <button type="button" onClick={() => setInspectorOpen(true)} className="fixed bottom-5 right-5 z-20 inline-flex items-center gap-2 rounded-lg border border-lime-300/20 bg-[#111720] px-3 py-2.5 text-[10px] font-medium text-lime-200 shadow-xl hover:bg-[#19212c] xl:hidden"><GitCompareArrows size={14} /> Show diff inspector</button>
      )}
      {replayOpen && <ReplayModal onClose={() => setReplayOpen(false)} onCreate={createReplay} capturedCount={traffic.total} />}
      {captureOpen && <CaptureModal onClose={() => setCaptureOpen(false)} onCapture={recordTraffic} />}
      {settingsOpen && <SettingsModal refreshInterval={refreshInterval} onRefreshIntervalChange={setRefreshInterval} onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
