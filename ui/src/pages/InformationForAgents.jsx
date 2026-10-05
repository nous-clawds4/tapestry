import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DevPage, { S } from './developers/DevPage';
import { buildAgentPrompt, BRIEFING_PATH } from '../utils/agentPrompt';

// "The Technology Behind Brainstorm": a builder describes their project and copies a prompt for their own AI agent.
// The prompt sends the agent to the plain-text briefing this host serves at BRIEFING_PATH
// (information-for-agents #1, ADR 0001). The page is the wrapper; the briefing is what the agent reads.

const field = {
  width: '100%', boxSizing: 'border-box', padding: '0.7rem 0.9rem', borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)',
  color: 'inherit', font: 'inherit', fontSize: '0.95rem', lineHeight: 1.5, resize: 'vertical',
};

export default function InformationForAgents() {
  const [project, setProject] = useState('');
  const [copyState, setCopyState] = useState('idle'); // idle | copied | failed
  const resetTimer = useRef(null);
  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const prompt = buildAgentPrompt({ project, origin: window.location.origin });

  const copy = async () => {
    clearTimeout(resetTimer.current);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(prompt);
      setCopyState('copied');
      resetTimer.current = setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('failed');
    }
  };

  return (
    <DevPage title="The Technology Behind Brainstorm" back={false}>
      <p style={{ ...S.p, margin: '0 0 0.8rem' }}>
        Building something on nostr? Brainstorm's web-of-trust scores and the protocols behind them are open, and you
        can use them in your own project. The fastest way to find out how is to ask your AI agent.
      </p>
      <p style={{ ...S.p, margin: 0 }}>
        Describe your project below, copy the prompt, and paste it into any agent that can read web pages.
      </p>

      <label htmlFor="ifa-project" style={{ ...S.h2, display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>
        What are you building?
      </label>
      <textarea
        id="ifa-project"
        rows={2}
        value={project}
        onChange={(e) => { setProject(e.target.value); setCopyState('idle'); }}
        placeholder="a nostr client for long-form writers"
        style={field}
      />

      <h2 style={S.h2}>Your prompt</h2>
      <pre style={{ ...S.pre, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.95rem' }}>{prompt}</pre>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginTop: '0.8rem' }}>
        <button type="button" className="bsp-action-btn" onClick={copy}>Copy prompt</button>
        <span role="status" aria-live="polite" style={{ fontSize: '0.85rem', opacity: 0.75 }}>
          {copyState === 'copied' && 'Copied'}
          {copyState === 'failed' && "Couldn't copy — select the text above and copy it."}
        </span>
      </div>

      <p style={{ ...S.p, marginTop: '2rem' }}>
        <a href={BRIEFING_PATH}>Read the briefing yourself</a> — it's what your agent will read.
        For hands-on integration docs, see the <Link to="/developers">developer documentation</Link>.
      </p>
    </DevPage>
  );
}
