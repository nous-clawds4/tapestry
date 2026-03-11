/**
 * Normalize API client.
 */
const API_BASE = '/api/normalize';

export async function normalizeSkeleton({ concept, node, dryRun } = {}) {
  const res = await fetch(`${API_BASE}/skeleton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ concept, node, dryRun }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Normalize request failed');
  return data;
}

export async function createConcept({ name, plural, description } = {}) {
  const res = await fetch(`${API_BASE}/create-concept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, plural, description }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Create concept failed');
  return data;
}

export async function createElement({ concept, name, json } = {}) {
  const res = await fetch(`${API_BASE}/create-element`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ concept, name, json }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Create element failed');
  return data;
}

export async function saveSchema({ concept, schema } = {}) {
  const res = await fetch(`${API_BASE}/save-schema`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ concept, schema }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Save schema failed');
  return data;
}

export async function createProperty({ name, concept, parentUuid, type, description, required } = {}) {
  const body = { name, type, description, required };
  if (concept) body.concept = concept;
  if (parentUuid) body.parentUuid = parentUuid;
  const res = await fetch(`${API_BASE}/create-property`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Create property failed');
  return data;
}

export async function generatePropertyTree({ concept } = {}) {
  const res = await fetch(`${API_BASE}/generate-property-tree`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ concept }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Generate property tree failed');
  return data;
}

export async function addNodeAsElement({ conceptUuid, nodeUuid } = {}) {
  const res = await fetch(`${API_BASE}/add-node-as-element`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conceptUuid, nodeUuid }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Add node as element failed');
  return data;
}

export async function normalizeJson({ concept, node } = {}) {
  const res = await fetch(`${API_BASE}/json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ concept, node }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Normalize request failed');
  return data;
}

export async function pruneSupersetEdges({ concept, relType }) {
  const res = await fetch('/api/normalize/prune-superset-edges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ concept, relType }),
  });
  return res.json();
}
