import { useCallback, useEffect, useState } from 'react'
import { createBrowserRouter, RouterProvider, useNavigate, useParams, useLocation, Outlet } from 'react-router-dom'
import Header from './components/Header.jsx'
import Drawer from './components/Drawer.jsx'
import MemberDrawerContent from './pages/MemberDrawerContent.jsx'
import Discover from './pages/Discover.jsx'
import CommunityDetail from './pages/CommunityDetail.jsx'
import MyCircles from './pages/MyCircles.jsx'
import Create from './pages/Create.jsx'
import Edit from './pages/Edit.jsx'
import NotFound from './pages/NotFound.jsx'
import {
  clearStoredViewerPubkey,
  getStoredViewerPubkey,
  signInWithNip07,
  storeViewerPubkey,
} from './auth/viewer.js'

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

  // Mocked joined / vouched sets, mutated by Join + Vouch interactions.
  const [joinedSet, setJoinedSet] = useState(
    () => new Set(['listening-room', 'sovereign-builders', 'brainstorm-collective']),
  )
  const [vouchedSet, setVouchedSet] = useState(() => new Set(['m2', 'm4', 'm8']))

  // Member drawer state — outlives route changes.
  const [drawerMember, setDrawerMember] = useState(null)
  const [drawerCommunitySlug, setDrawerCommunitySlug] = useState(null)

  const handleJoin = useCallback(
    slug => setJoinedSet(prev => new Set([...prev, slug])),
    [],
  )
  const handleLeave = useCallback(slug => {
    setJoinedSet(prev => {
      const next = new Set(prev)
      next.delete(slug)
      return next
    })
  }, [])
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
      { path: 'edit/:slug', element: <EditRoute /> },
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
