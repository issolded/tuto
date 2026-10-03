const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validDraft(body) {
  return UUID.test(body.id || '') && Number.isInteger(body.revision) && body.revision >= 0
    && typeof body.title === 'string' && body.title.length <= 200
    && typeof body.text === 'string' && body.text.length <= 50000;
}
export function sameDraft(story, body) {
  return story.status === 'in_progress' && story.writing_source === 'typed'
    && story.title === body.title && story.transcribed_text === body.text
    && story.corrected_text === body.text;
}
// No model, reward or notification calls belong in this handler.
export function storyDraftHandler(db) {
  return async (req, res) => {
    const { childId } = req.params;
    const body = req.body || {};
    if (!UUID.test(childId) || !validDraft(body)) return res.status(400).json({ error: 'invalid_draft' });
    try {
      const { data: child, error: childError } = await db.from('children').select('id').eq('id', childId).maybeSingle();
      if (childError) throw childError;
      if (!child) return res.status(404).json({ error: 'child_not_found' });
      const read = () => db.from('stories').select('*').eq('id', body.id).eq('child_id', childId).maybeSingle();
      const { data: existing, error } = await read();
      if (error) throw error;
      if (existing) {
        if (sameDraft(existing, body)) return res.json({ story: existing });
        if (existing.writing_source !== 'typed' || existing.status !== 'in_progress' || existing.revision !== body.revision)
          return res.status(409).json({ error: 'draft_conflict', story: existing });
        const { data: saved, error: updateError } = await db.from('stories')
          .update({ title: body.title, transcribed_text: body.text, corrected_text: body.text, draft_assessment: null })
          .eq('id', body.id).eq('child_id', childId).eq('revision', body.revision).eq('status', 'in_progress')
          .select().maybeSingle();
        if (updateError) throw updateError;
        if (!saved) { const current = await read(); return res.status(409).json({ error: 'draft_conflict', story: current.data }); }
        return res.json({ story: saved });
      }
      if (body.revision !== 0) return res.status(409).json({ error: 'draft_missing' });
      if (!body.text.trim()) return res.status(400).json({ error: 'empty_draft' });
      const { data: saved, error: insertError } = await db.from('stories').insert({
        id: body.id, child_id: childId, title: body.title, topic: '', writing_source: 'typed',
        transcribed_text: body.text, corrected_text: body.text, status: 'in_progress', gems_earned: 0
      }).select().single();
      if (insertError?.code === '23505') {
        const current = await read();
        if (current.data && sameDraft(current.data, body)) return res.json({ story: current.data });
        return res.status(409).json({ error: 'draft_conflict', story: current.data });
      }
      if (insertError) throw insertError;
      return res.json({ story: saved });
    } catch (err) {
      console.error('[story-draft]', err.code || err.message);
      return res.status(503).json({ error: 'draft_unavailable' });
    }
  };
}

export function storyAssessmentHandler(db, evaluate) {
  return async (req, res) => {
    const { childId } = req.params;
    const { id, revision } = req.body || {};
    if (!UUID.test(childId) || !UUID.test(id || '') || !Number.isInteger(revision))
      return res.status(400).json({ error: 'invalid_request' });
    try {
      const { data: story, error } = await db.from('stories').select('*').eq('id', id).eq('child_id', childId).maybeSingle();
      if (error) throw error;
      if (!story) return res.status(404).json({ error: 'story_not_found' });
      if (story.writing_source !== 'typed' || story.status !== 'in_progress' || story.revision !== revision)
        return res.status(409).json({ error: 'draft_conflict' });
      const { data: child, error: childError } = await db.from('children').select('age,language').eq('id', childId).single();
      if (childError) throw childError;
      const text = story.transcribed_text || '';
      if (story.draft_assessment?.transcribed_text === text) return res.json({ story, evaluation: story.draft_assessment });
      const result = await evaluate(text, child);
      if (!Number.isFinite(result.quality) || typeof result.encouragement !== 'string' || typeof result.has_profanity !== 'boolean')
        throw new Error('invalid_assessment');
      const evaluation = {
        quality: Math.max(0, Math.min(100, result.quality)), encouragement: result.encouragement,
        has_profanity: result.has_profanity, too_short: text.trim().split(/\s+/u).filter(Boolean).length < 15,
        transcribed_text: text, uncertain_words: [],
        spelling_errors: Array.isArray(result.spelling_errors) ? result.spelling_errors.filter(e =>
          typeof e.wrong === 'string' && e.wrong && text.includes(e.wrong) && typeof e.correct === 'string'
          && e.correct && e.wrong !== e.correct).slice(0, 20) : []
      };
      const { data: saved, error: saveError } = await db.from('stories')
        .update({ draft_assessment: { ...evaluation, revision: revision + 1 } })
        .eq('id', id).eq('child_id', childId).eq('revision', revision).eq('status', 'in_progress')
        .select().maybeSingle();
      if (saveError) throw saveError;
      if (!saved) return res.status(409).json({ error: 'draft_conflict' });
      return res.json({ story: saved, evaluation });
    } catch (err) {
      console.error('[story-assessment]', err.code || err.message);
      return res.status(503).json({ error: 'assessment_unavailable' });
    }
  };
}
