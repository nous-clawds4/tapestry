/**
 * Audit API client.
 * Calls the server-side audit endpoints (single source of truth).
 */

const API_BASE = '/api/audit';

async function fetchAudit(path) {
  const res = await fetch(`${API_BASE}${path}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Audit request failed');
  return data;
}

export async function auditHealth() {
  return fetchAudit('/health');
}

export async function auditConcept(concept) {
  return fetchAudit(`/concept?concept=${encodeURIComponent(concept)}`);
}

export async function auditStats() {
  return fetchAudit('/stats');
}

export async function auditSkeletons(concept) {
  const params = concept ? `?concept=${encodeURIComponent(concept)}` : '';
  return fetchAudit(`/skeletons${params}`);
}

export async function auditOrphans() {
  return fetchAudit('/orphans');
}

export async function auditWiring() {
  return fetchAudit('/wiring');
}

export async function auditLabels() {
  return fetchAudit('/labels');
}

export async function auditBios() {
  return fetchAudit('/bios');
}

export async function auditThreads({ concept, mode, through, depth } = {}) {
  const params = new URLSearchParams();
  if (concept) params.set('concept', concept);
  if (mode) params.set('mode', mode);
  if (through) params.set('through', through);
  if (depth) params.set('depth', depth);
  const qs = params.toString();
  return fetchAudit(`/threads${qs ? '?' + qs : ''}`);
}
