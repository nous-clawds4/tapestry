const API_BASE = '/api/firmware';

export async function fetchFirmwareManifest() {
  const res = await fetch(`${API_BASE}/manifest`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to fetch firmware manifest');
  return data;
}

export async function fetchFirmwareConcept(slug) {
  const res = await fetch(`${API_BASE}/concept/${encodeURIComponent(slug)}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to fetch firmware concept');
  return data;
}
