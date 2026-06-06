import { useCallback, useEffect, useState } from 'react'
import { createBrowserRouter, RouterProvider, useNavigate, useParams, useLocation, Outlet } from 'react-router-dom'
import Header from './components/Header.jsx'
import Drawer from './components/Drawer.jsx'
import MemberDrawerContent from './pages/MemberDrawerContent.jsx'
import Discover from './pages/Discover.jsx'
import CommunityDetail from './pages/CommunityDetail.jsx'
import MyCircles from './pages/MyCircles.jsx'
import Create from './pages/Create.jsx'
import Found from './pages/Found.jsx'
import Edit from './pages/Edit.jsx'
import NotificationSettings from './pages/NotificationSettings.jsx'
import NotFound from './pages/NotFound.jsx'
import {
  clearStoredViewerPubkey,
  getStoredViewerPubkey,
  signInWithNip07,
  storeViewerPubkey,
} from './auth/viewer.js'
import { IS_MOCK_MODE } from './api/client.js'

// Mock-mode seed so dev starts with three example circles. In real
// mode (VITE_USE_MOCK_DATA=false) the joined set starts empty and is
// hydrated from localStorage per-viewer; the only entries are circles
// the viewer has actually joined or created.
const MOCK_JOINED_SEED = ['listening-room', 'sovereign-builders', 'brainstorm-collective']
const JOINED_STORAGE_KEY = 'brainstorm-communities:joined'

function loadJoinedSet(viewerPubkey) {
  if (IS_MOCK_MODE) return new Set(MOCK_JOINED_SEED)
  if (!viewerPubkey) return new Set()
  try {
    const raw = localStorage.getItem(`${JOINED_STORAGE_KEY}:${viewerPubkey}`)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

function saveJoinedSet(viewerPubkey, set) {
  if (IS_MOCK_MODE || !viewerPubkey) return
  try {
    localStorage.setItem(
      `${JOINED_STORAGE_KEY}:${viewerPubkey}`,
      JSON.stringify(Array.from(set)),
    )
  } catch { /* localStorage full / disabled — best effort */ }
}

/*
 * AppState — local-state layer for Slices 0-4.
 *
 * Slice 4 introduced the viewer pubkey (NIP-07-resolved, persisted to
 * localStorage). The boolean signedIn derives from viewer !== null.
 * joinedSet + vouchedSet stay local-optimistic; the publish wrapper
 * (src/events/publish.js) handles the real publish path.
 */

function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()

  // Viewer pubkey (hex, 64 chars) restored from localStorage on mount.
  const [viewer, setViewer] = useState(() => getStoredViewerPubkey())
  const signedIn = viewer !== null

  // joinedSet: dev seeds three example circles; real mode hydrates from
  // localStorage per-viewer so circles a user joins/creates survive
  // refreshes and don't bleed across accounts.
  const [joinedSet, setJoinedSetRaw] = useState(() => loadJoinedSet(viewer))
  const [vouchedSet, setVouchedSet] = useState(() => (IS_MOCK_MODE ? new Set(['m2', 'm4', 'm8']) : new Set()))

  const setJoinedSet = useCallback(updater => {
    setJoinedSetRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      saveJoinedSet(viewer, next)
      return next
    })
  }, [viewer])

  // Re-hydrate joinedSet whenever the viewer pubkey changes (sign-in,
  // sign-out, or a different viewer in the same browser). The lint
  // rule flags the idiomatic "reset state when prop changes" pattern;
  // a key-based remount of AppShell is out of scope.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJoinedSetRaw(loadJoinedSet(viewer))
  }, [viewer])

  // Member drawer state — outlives route changes.
  const [drawerMember, setDrawerMember] = useState(null)
  const [drawerCommunitySlug, setDrawerCommunitySlug] = useState(null)

  const handleJoin = useCallback(
    slug => setJoinedSet(prev => new Set([...prev, slug])),
    [setJoinedSet],
  )
  const handleLeave = useCallback(slug => {
    setJoinedSet(prev => {
      const next = new Set(prev)
      next.delete(slug)
      return next
    })
  }, [setJoinedSet])
  const toggleVouch = useCallback(memberId => {
    setVouchedSet(prev => {
      const next = new Set(prev)
      if (next.has(memberId)) next.delete(memberId)
      else next.add(memberId)
      return next
    })
  }, [])

  const openDrawer = useCallback((memberId, communitySlug) => {
    setDrawerMember(memberId)
    setDrawerCommunitySlug(communitySlug)
  }, [])
  const closeDrawer = useCallback(() => setDrawerMember(null), [])

  const handleSignIn = useCallback(async () => {
    const result = await signInWithNip07()
    if (result.ok) {
      storeViewerPubkey(result.pubkey)
      setViewer(result.pubkey)
    }
    return result
  }, [])

  const handleSignOut = useCallback(() => {
    clearStoredViewerPubkey()
    setViewer(null)
  }, [])

  // Smooth-scroll to top on route change so deep-linked navigation doesn't
  // leave the viewport at an unrelated scroll position.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])

  const ctx = {
    viewer,
    signedIn,
    joinedSet,
    vouchedSet,
    setJoinedSet,
    setVouchedSet,
    onJoin: handleJoin,
    onLeave: handleLeave,
    onVouch: toggleVouch,
    onOpenDrawer: openDrawer,
    onSignIn: handleSignIn,
    onSignOut: handleSignOut,
    navigate,
    pathname: location.pathname,
  }

  return (
    <>
      <Header
        viewer={viewer}
        signedIn={signedIn}
        pathname={location.pathname}
        onNavigate={navigate}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />
      <main>
        <Outlet context={ctx} />
      </main>
      <Drawer open={!!drawerMember} onClose={closeDrawer}>
        {drawerMember && (
          <MemberDrawerContent
            memberId={drawerMember}
            communitySlug={drawerCommunitySlug}
            vouchedSet={vouchedSet}
            onVouch={toggleVouch}
            signedIn={signedIn}
            viewer={viewer}
          />
        )}
      </Drawer>
    </>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <NotFound />,
    children: [
      { index: true, element: <Discover /> },
      { path: 'community/:slug', element: <CommunityDetailRoute /> },
      { path: 'my-circles', element: <MyCircles /> },
      { path: 'create', element: <Create /> },
      { path: 'found', element: <Found /> },
      { path: 'edit/:slug', element: <EditRoute /> },
      { path: 'settings', element: <NotificationSettings /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

function CommunityDetailRoute() {
  const { slug } = useParams()
  return <CommunityDetail slug={slug} />
}
function EditRoute() {
  const { slug } = useParams()
  return <Edit slug={slug} />
}

export default function App() {
  return <RouterProvider router={router} />
}
