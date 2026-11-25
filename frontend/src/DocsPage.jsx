import React, { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Code2,
  Copy,
  Database,
  ExternalLink,
  FileJson2,
  Layers3,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react'

const methodStyles = {
  GET: 'border-sky-300/20 bg-sky-300/10 text-sky-200',
  POST: 'border-lime-300/20 bg-lime-300/10 text-lime-200',
  PUT: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
  PATCH: 'border-violet-300/20 bg-violet-300/10 text-violet-200',
  DELETE: 'border-rose-300/20 bg-rose-300/10 text-rose-200',
}

const groupIcons = {
  Workspace: Layers3,
  'Captured traffic': Database,
  'Replay runs': Code2,
  'Regression cases': FileJson2,
  'Demo services v1': Terminal,
  'Demo services v2': Sparkles,
}

function resolveSchema(schema, components) {
  const reference = schema?.$ref
  if (!reference) return schema || {}
  const name = reference.split('/').pop()
  return components?.[name] || schema
}

function makeExample(schema, components, depth = 0) {
  const value = resolveSchema(schema, components)
  if (depth > 4) return null
  if (value.example !== undefined) return value.example
  if (value.default !== undefined) return value.default
  if (value.enum?.length) return value.enum[0]
  if (value.type === 'array') return [makeExample(value.items, components, depth + 1)]
  if (value.type === 'object' || value.properties) {
    return Object.fromEntries(
      Object.entries(value.properties || {}).map(([key, property]) => [
        key,
        makeExample(property, components, depth + 1),
      ]),
    )
  }
  if (value.type === 'integer' || value.type === 'number') return 0
  if (value.type === 'boolean') return false
  if (value.type === 'null') return null
  return value.type === 'string' ? 'string' : null
}

function getOperations(spec) {
  const methods = new Set(['get', 'post', 'put', 'patch', 'delete'])
  const tagOrder = new Map((spec.tags || []).map((tag, index) => [tag.name, index]))
  const operations = Object.entries(spec.paths || {}).flatMap(([path, pathItem]) => (
    Object.entries(pathItem)
      .filter(([method]) => methods.has(method.toLowerCase()))
      .map(([method, operation]) => ({
        path,
        method: method.toUpperCase(),
        operation,
        tag: operation.tags?.[0] || 'Other',
        id: `${method.toUpperCase()} ${path}`,
      }))
  ))
  return operations.sort((left, right) => (
    (tagOrder.get(left.tag) ?? 999) - (tagOrder.get(right.tag) ?? 999)
    || left.path.localeCompare(right.path)
    || left.method.localeCompare(right.method)
  ))
}

function SchemaProperties({ schema, components }) {
  const resolved = resolveSchema(schema, components)
  const properties = Object.entries(resolved.properties || {})
  if (!properties.length) {
    return <p className="text-xs text-slate-500">The request body accepts a JSON value.</p>
  }
  const required = new Set(resolved.required || [])
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      {properties.map(([name, property], index) => {
        const definition = resolveSchema(property, components)
        const type = definition.type || property.$ref?.split('/').pop() || 'any'
        return (
          <div key={name} className={`grid grid-cols-[minmax(110px,1fr)_90px_minmax(75px,.7fr)] items-center gap-3 px-3 py-2.5 text-[11px] ${index ? 'border-t border-line' : ''}`}>
            <span className="mono truncate text-slate-200">{name}</span>
            <span className="mono text-sky-300">{type}{definition.format ? ` · ${definition.format}` : ''}</span>
            <span className={required.has(name) ? 'text-amber-300' : 'text-slate-600'}>{required.has(name) ? 'required' : 'optional'}</span>
          </div>
        )
      })}
    </div>
  )
}

function OperationDetails({ item, spec }) {
  const { operation } = item
  const parameters = operation.parameters || []
  const requestMedia = Object.entries(operation.requestBody?.content || {})
  const components = spec.components?.schemas || {}

  return (
    <div className="border-t border-line/80 bg-[#0b1017] px-4 pb-4 pt-4 sm:px-5">
      {operation.description && <p className="mb-4 max-w-3xl text-xs leading-relaxed text-slate-400">{operation.description}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-line bg-[#0e141d] p-3.5">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            <Code2 size={13} className="text-sky-300" /> Parameters
          </div>
          {parameters.length ? (
            <div className="space-y-2.5">
              {parameters.map((parameter) => (
                <div key={`${parameter.in}-${parameter.name}`} className="flex items-start justify-between gap-3 border-b border-line/70 pb-2 last:border-0 last:pb-0">
                  <div>
                    <p className="mono text-[11px] text-slate-200">{parameter.name}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{parameter.in}{parameter.description ? ` · ${parameter.description}` : ''}</p>
                  </div>
                  <span className={`shrink-0 text-[9px] ${parameter.required ? 'text-amber-300' : 'text-slate-600'}`}>
                    {parameter.required ? 'required' : 'optional'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No path or query parameters.</p>
          )}
        </section>

        <section className="rounded-lg border border-line bg-[#0e141d] p-3.5">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            <FileJson2 size={13} className="text-lime-300" /> Request body
          </div>
          {requestMedia.length ? requestMedia.map(([contentType, media]) => {
            const example = media.example ?? makeExample(media.schema, components)
            return (
              <div key={contentType}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="mono text-[10px] text-slate-400">{contentType}</span>
                  <span className="text-[9px] text-slate-600">{media.schema?.$ref?.split('/').pop() || media.schema?.type || 'JSON'}</span>
                </div>
                <SchemaProperties schema={media.schema} components={components} />
                <pre className="mt-3 max-h-48 overflow-auto rounded-lg border border-line bg-[#080d13] p-3 text-[10px] leading-relaxed text-lime-100">{JSON.stringify(example, null, 2)}</pre>
              </div>
            )
          }) : <p className="text-xs text-slate-500">This operation does not require a request body.</p>}
        </section>
      </div>

      <section className="mt-4 rounded-lg border border-line bg-[#0e141d] p-3.5">
        <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          <Check size={13} className="text-emerald-300" /> Responses
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(operation.responses || {}).map(([status, response]) => (
            <div key={status} className="flex items-start gap-2 rounded-md border border-line/80 bg-[#0b1017] px-3 py-2">
              <span className={`mono text-[11px] ${status.startsWith('2') ? 'text-emerald-300' : 'text-amber-300'}`}>{status}</span>
              <span className="text-[10px] leading-relaxed text-slate-400">{response.description || 'Response'}</span>
            </div>
          ))}
        </div>
      </section>
      <a href="/swagger-ui" className="mt-4 inline-flex items-center gap-2 text-[10px] font-medium text-lime-300 transition hover:text-lime-200">
        Try this endpoint in Swagger UI <ArrowUpRight size={12} />
      </a>
    </div>
  )
}

export default function DocsPage() {
  const [spec, setSpec] = useState(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [activeGroup, setActiveGroup] = useState('All endpoints')
  const [methodFilter, setMethodFilter] = useState('ALL')
  const [expanded, setExpanded] = useState('')
  const [copied, setCopied] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    document.title = 'ShadowTraffic API reference'
    let active = true
    fetch('/openapi.json')
      .then((response) => {
        if (!response.ok) throw new Error(`OpenAPI request failed (${response.status})`)
        return response.json()
      })
      .then((data) => {
        if (active) {
          setSpec(data)
          setError('')
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Could not load the API schema.')
      })
    return () => { active = false }
  }, [reloadKey])

  const operations = useMemo(() => spec ? getOperations(spec) : [], [spec])
  const groups = useMemo(() => {
    if (!spec) return []
    return (spec.tags || []).map((tag) => ({
      ...tag,
      count: operations.filter((operation) => operation.tag === tag.name).length,
      icon: groupIcons[tag.name] || CircleHelp,
    })).filter((tag) => tag.count > 0)
  }, [operations, spec])
  const visibleOperations = useMemo(() => {
    const query = search.trim().toLowerCase()
    return operations.filter((item) => {
      const matchesGroup = activeGroup === 'All endpoints' || item.tag === activeGroup
      const matchesMethod = methodFilter === 'ALL' || item.method === methodFilter
      const haystack = `${item.path} ${item.method} ${item.operation.summary || ''} ${item.operation.operationId || ''} ${item.tag}`.toLowerCase()
      return matchesGroup && matchesMethod && (!query || haystack.includes(query))
    })
  }, [activeGroup, methodFilter, operations, search])

  async function copyEndpoint(path) {
    try {
      await navigator.clipboard.writeText(path)
      setCopied(path)
      window.setTimeout(() => setCopied(''), 1500)
    } catch {
      setError('Clipboard access was denied. Select and copy the endpoint path instead.')
    }
  }

  const openapiVersion = spec?.openapi || 'OpenAPI'
  const schemaCount = Object.keys(spec?.components?.schemas || {}).length

  return (
    <div className="min-h-screen bg-[#090c12] text-slate-100">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-[#090c12]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a href="/" className="flex shrink-0 items-center gap-3 text-slate-100 no-underline">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-lime-300/20 bg-lime-300/10 text-[11px] font-bold text-lime-200">ST</span>
            <span className="grid gap-0.5">
              <span className="text-[13px] font-semibold tracking-wide">shadowtraffic</span>
              <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-500">API reference</span>
            </span>
          </a>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-lime-300/15 bg-lime-300/[0.06] px-2.5 py-1.5 text-[9px] font-medium text-lime-200 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-lime-300 shadow-[0_0_8px_rgba(163,230,53,.8)]" /> Local demo
            </span>
            <a href="/openapi.json" className="hidden items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-2 text-[10px] text-slate-300 transition hover:border-slate-600 hover:text-white sm:inline-flex">
              <FileJson2 size={13} /> OpenAPI JSON
            </a>
            <a href="/swagger-ui" className="inline-flex items-center gap-1.5 rounded-lg bg-lime-300 px-3 py-2 text-[10px] font-semibold text-[#151a11] transition hover:bg-lime-200">
              <Terminal size={13} /> Try API
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-0 px-0 md:grid-cols-[230px_minmax(0,1fr)] lg:grid-cols-[250px_minmax(0,1fr)] lg:px-5">
        <aside className="border-b border-line/80 bg-[#0b1017]/70 px-4 py-4 md:min-h-[calc(100vh-68px)] md:border-b-0 md:border-r md:px-4 md:py-6 lg:sticky lg:top-[68px] lg:h-[calc(100vh-68px)] lg:overflow-y-auto">
          <div className="mb-4 flex items-center justify-between md:px-2">
            <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">Reference</span>
            <BookOpen size={13} className="text-slate-600" />
          </div>
          <nav aria-label="API sections" className="scrollbar-hidden flex gap-1 overflow-x-auto md:block">
            <button type="button" onClick={() => { setActiveGroup('All endpoints'); setExpanded('') }} className={`mb-1 flex min-w-max w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-[11px] transition ${activeGroup === 'All endpoints' ? 'bg-white/[0.06] text-white' : 'text-slate-400 hover:bg-white/[0.035] hover:text-slate-200'}`}>
              <Layers3 size={14} className="text-lime-300" /> All endpoints
              <span className="ml-auto pl-2 text-[9px] text-slate-600">{operations.length || '—'}</span>
            </button>
            {groups.map((group) => {
              const Icon = group.icon
              const active = activeGroup === group.name
              return (
                <button key={group.name} type="button" onClick={() => { setActiveGroup(group.name); setExpanded('') }} className={`mb-1 flex min-w-max w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-[11px] transition ${active ? 'bg-white/[0.06] text-white' : 'text-slate-400 hover:bg-white/[0.035] hover:text-slate-200'}`}>
                  <Icon size={14} className={active ? 'text-lime-300' : 'text-slate-500'} />
                  <span>{group.name}</span>
                  <span className="ml-auto pl-2 text-[9px] text-slate-600">{group.count}</span>
                </button>
              )
            })}
          </nav>

          <div className="mt-6 hidden border-t border-line/80 pt-5 md:block">
            <p className="mb-3 px-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">At a glance</p>
            <div className="space-y-2 px-2">
              <div className="flex items-center justify-between text-[10px]"><span className="text-slate-500">Version</span><span className="mono text-slate-300">{spec?.info?.version || '—'}</span></div>
              <div className="flex items-center justify-between text-[10px]"><span className="text-slate-500">Schema</span><span className="mono text-slate-300">{openapiVersion}</span></div>
              <div className="flex items-center justify-between text-[10px]"><span className="text-slate-500">Models</span><span className="mono text-slate-300">{spec ? schemaCount : '—'}</span></div>
            </div>
          </div>

          <div className="mt-7 hidden rounded-xl border border-sky-300/10 bg-sky-300/[0.045] p-3 md:block">
            <ShieldCheck size={15} className="text-sky-300" />
            <p className="mt-2 text-[10px] font-medium text-slate-300">Safe by default</p>
            <p className="mt-1 text-[9px] leading-relaxed text-slate-500">Shadow replay targets are fixed to local demo services.</p>
          </div>
        </aside>

        <main className="min-w-0 px-4 pb-12 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          <div className="mb-5 flex items-center gap-2 text-[10px] text-slate-500">
            <span>Developer</span><ChevronRight size={12} /><span className="text-slate-300">API reference</span>
          </div>

          <section className="relative overflow-hidden rounded-2xl border border-line bg-panel px-5 py-6 sm:px-7 sm:py-7">
            <div className="pointer-events-none absolute -right-14 -top-20 h-64 w-64 rounded-full bg-lime-300/[0.07] blur-3xl" />
            <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_310px] lg:items-end">
              <div>
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-lime-300/15 bg-lime-300/[0.06] px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.13em] text-lime-200">
                  <Sparkles size={11} /> Developer documentation
                </div>
                <h1 className="max-w-2xl text-[30px] font-semibold leading-[1.08] tracking-[-0.045em] text-white sm:text-[38px]">
                  Understand every request.<br /><span className="text-lime-300">Catch every change.</span>
                </h1>
                <p className="mt-3 max-w-xl text-[12px] leading-relaxed text-slate-400">
                  Browse the ShadowTraffic API, inspect payload shapes, and open an endpoint in the interactive runner when you are ready to try it.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Endpoints', value: spec ? operations.length : '—', icon: Code2 },
                  { label: 'Sections', value: spec ? groups.length : '—', icon: Layers3 },
                  { label: 'Schemas', value: spec ? schemaCount : '—', icon: FileJson2 },
                ].map((stat) => {
                  const Icon = stat.icon
                  return (
                    <div key={stat.label} className="rounded-xl border border-line bg-[#0c1118]/75 px-3 py-3">
                      <Icon size={14} className="text-slate-500" />
                      <p className="mt-2 text-xl font-semibold tracking-tight text-slate-100">{stat.value}</p>
                      <p className="mt-0.5 text-[9px] text-slate-500">{stat.label}</p>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="relative mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line/80 pt-4 text-[9px] text-slate-500">
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-lime-300" /> Loopback demo</span>
              <span>OpenAPI {openapiVersion}</span>
              <span>Base URL <code className="mono text-slate-300">http://127.0.0.1:8000</code></span>
            </div>
          </section>

          <section className="mt-6">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">{activeGroup === 'All endpoints' ? 'Endpoints' : activeGroup}</h2>
                <p className="mt-1 text-[10px] text-slate-500">
                  {visibleOperations.length} {visibleOperations.length === 1 ? 'operation' : 'operations'} · Select an endpoint to inspect its contract
                </p>
              </div>
              <a href="/swagger-ui" className="hidden items-center gap-1.5 text-[10px] text-slate-400 transition hover:text-lime-200 sm:inline-flex">
                Open full Swagger UI <ExternalLink size={11} />
              </a>
            </div>

            <div className="mb-3 flex flex-col gap-2 sm:flex-row">
              <label className="relative min-w-0 flex-1">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search paths, operations, or groups…" className="h-10 w-full rounded-lg border border-line bg-[#0c1118] pl-9 pr-9 text-[11px] text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-lime-300/40" />
                {search && <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-white" aria-label="Clear search"><X size={12} /></button>}
              </label>
              <label className="relative">
                <span className="sr-only">Filter by HTTP method</span>
                <select value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)} className="h-10 w-full appearance-none rounded-lg border border-line bg-[#0c1118] py-0 pl-3 pr-9 text-[10px] text-slate-300 outline-none focus:border-lime-300/40 sm:w-36">
                  <option value="ALL">All methods</option>
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => <option key={method} value={method}>{method}</option>)}
                </select>
                <ChevronDown size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
              </label>
            </div>

            {error ? (
              <div role="alert" className="rounded-xl border border-rose-300/15 bg-rose-300/[0.05] p-4">
                <p className="text-xs font-medium text-rose-200">Could not load the API reference</p>
                <p className="mt-1 text-[10px] text-slate-400">{error}</p>
                <button type="button" onClick={() => { setError(''); setReloadKey((key) => key + 1) }} className="mt-3 rounded-lg border border-rose-300/20 px-3 py-1.5 text-[10px] text-rose-200 hover:bg-rose-300/10">Retry</button>
              </div>
            ) : !spec ? (
              <div className="rounded-xl border border-line bg-panel p-5 text-xs text-slate-500">Loading OpenAPI schema…</div>
            ) : visibleOperations.length ? (
              <div className="space-y-2">
                {visibleOperations.map((item) => {
                  const isExpanded = expanded === item.id
                  return (
                    <article key={item.id} className={`overflow-hidden rounded-xl border transition ${isExpanded ? 'border-lime-300/20 bg-panel shadow-[0_12px_36px_rgba(0,0,0,.16)]' : 'border-line bg-panel hover:border-slate-700'}`}>
                      <div className="flex items-stretch">
                        <button type="button" aria-expanded={isExpanded} onClick={() => setExpanded(isExpanded ? '' : item.id)} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left sm:gap-4 sm:px-4">
                          <span className={`mono inline-flex w-[58px] shrink-0 justify-center rounded-md border px-1.5 py-1.5 text-[9px] font-semibold ${methodStyles[item.method] || 'border-slate-500/20 bg-slate-500/10 text-slate-300'}`}>{item.method}</span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <code className="mono text-[11px] text-slate-100">{item.path}</code>
                              <span className="text-[8px] text-slate-600">{item.tag}</span>
                            </span>
                            <span className="mt-1 block truncate text-[10px] text-slate-500">{item.operation.summary || item.operation.operationId}</span>
                          </span>
                          {isExpanded ? <ChevronDown size={14} className="shrink-0 text-lime-300" /> : <ChevronRight size={14} className="shrink-0 text-slate-600" />}
                        </button>
                        <button type="button" onClick={() => copyEndpoint(item.path)} className="mx-2 my-2 hidden w-9 shrink-0 place-items-center rounded-md border border-line text-slate-500 transition hover:border-slate-600 hover:text-slate-200 sm:grid" aria-label={`Copy ${item.path}`}>
                          {copied === item.path ? <Check size={13} className="text-lime-300" /> : <Copy size={12} />}
                        </button>
                      </div>
                      {isExpanded && <OperationDetails item={item} spec={spec} />}
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-line bg-panel px-5 py-10 text-center">
                <Search size={18} className="mx-auto text-slate-600" />
                <p className="mt-3 text-xs font-medium text-slate-300">No matching endpoints</p>
                <p className="mt-1 text-[10px] text-slate-500">Try another search term or method filter.</p>
              </div>
            )}
          </section>

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line/80 pt-4 text-[9px] text-slate-600">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck size={12} /> Requests from this reference target local demo services only.</span>
            <a href="/openapi.json" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-300">Raw schema <ArrowUpRight size={10} /></a>
          </footer>
        </main>
      </div>
    </div>
  )
}
