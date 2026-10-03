export const draftKey = (childId, id) => 'tuto_story_draft:' + childId + ':' + id;
export function readLocalDrafts(childId, storage = localStorage) {
  try {
    const prefix = draftKey(childId, '');
    return Object.keys(storage).filter(k => k.startsWith(prefix)).flatMap(k => {
      try { const d = JSON.parse(storage.getItem(k)); return d?.id && typeof d.text === 'string' ? [d] : []; } catch { return []; }
    });
  } catch { return []; }
}
export function mergeDrafts(stories, childId, storage = localStorage) {
  const result = [...stories];
  for (const d of readLocalDrafts(childId, storage)) {
    const i = result.findIndex(s => s.id === d.id);
    if (i >= 0) {
      if (d.dirty && result[i].writing_source === 'typed') result[i] = { ...result[i], title: d.title, status: 'in_progress' };
      continue; // Writer reconciles against a fresh server read.
    }
    if (!d.dirty) continue; // A deleted server draft must not reappear from a clean cache.
    if (!d.text.trim()) continue;
    result.push({ id: d.id, child_id: childId, title: d.title, transcribed_text: d.text,
      corrected_text: d.text, writing_source: 'typed', status: 'in_progress',
      revision: d.revision, updated_at: d.savedAt, local_only: true });
  }
  return result.sort((a,b) => Date.parse(b.updated_at || b.created_at || 0) - Date.parse(a.updated_at || a.created_at || 0));
}
export async function saveDraft(childId, draft) {
  const server = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app';
  const response = await fetch(server + '/api/children/' + encodeURIComponent(childId) + '/story-draft', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: draft.id, title: draft.title, text: draft.text, revision: draft.revision }),
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.error || 'draft_unavailable'); error.status = response.status; error.story = data.story; throw error; }
  return data.story;
}
