const API_ROOT = '/api'

export async function api(path, options = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const payload = await response.json()
      message = payload.detail || message
    } catch {
      // Keep the HTTP status as the actionable error when a response isn't JSON.
    }
    throw new Error(message)
  }

  if (response.status === 204) return null
  const contentType = response.headers.get('content-type') || ''
  return contentType.includes('application/json') ? response.json() : response.text()
}

export function jsonBody(value) {
  return JSON.stringify(value)
}
