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

export async function fetchFirmwareVersions() {
  const res = await fetch(`${API_BASE}/versions`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to fetch firmware versions');
  return data;
}

export async function fetchInstallStatus() {
  const res = await fetch(`${API_BASE}/install-status`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to fetch install status');
  return data;
}

export async function installFirmware({ pass1 = true, pass2 = true, dryRun = false } = {}) {
  const res = await fetch(`${API_BASE}/install`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pass1, pass2, dryRun }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Firmware install failed');
  return data;
}
