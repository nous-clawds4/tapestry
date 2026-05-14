import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Button from '../components/Button.jsx'
import FormInput from '../components/FormInput.jsx'
import TagPill from '../components/TagPill.jsx'
import ViewCallout from '../components/ViewCallout.jsx'
import { getCommunity } from '../data/mockData.js'
import s from './Edit.module.css'

export default function Edit({ slug }) {
  const { navigate } = useOutletContext()
  const c = getCommunity(slug)
  const [name, setName] = useState(c?.name || '')
  const [description, setDescription] = useState(c?.description || '')

  if (!c) {
    return (
      <div className={s.page}>
        <p className={s.missing}>Circle not found.</p>
        <Button variant="primary" onClick={() => navigate('/')}>Back to Discover</Button>
      </div>
    )
  }

  return (
    <div className={s.page}>
      <button type="button" className={s.back} onClick={() => navigate(`/community/${c.slug}`)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to {c.name}
      </button>

      <ViewCallout />

      <h1 className={s.title}>Edit: {c.name}</h1>

      <FormInput label="Circle name (your view)" value={name} onChange={setName} />
      <FormInput
        label="Description (your view)"
        value={description}
        onChange={setDescription}
        multiline
      />

      <div className={s.field}>
        <label className={s.label}>Topics (your view)</label>
        <div className={s.tagRow}>
          {c.tags.map(t => <TagPill key={t} tag={t} active small />)}
        </div>
      </div>

      <section className={s.advanced}>
        <h4 className={s.advancedTitle}>Advanced</h4>
        <dl className={s.advancedGrid}>
          <div>
            <dt className={s.advancedKey}>Founding voices</dt>
            <dd className={s.advancedVal}>{c.members.length} people</dd>
          </div>
          <div>
            <dt className={s.advancedKey}>Trust threshold</dt>
            <dd className={s.advancedVal}>Balanced (default)</dd>
          </div>
          <div>
            <dt className={s.advancedKey}>Scoring model</dt>
            <dd className={s.advancedVal}>gr-community-default-v1</dd>
          </div>
        </dl>
      </section>

      <div className={s.actions}>
        <Button variant="ghost" onClick={() => navigate(`/community/${c.slug}`)}>Cancel</Button>
        <Button variant="primary" onClick={() => navigate(`/community/${c.slug}`)}>
          Save your view
        </Button>
      </div>
    </div>
  )
}
