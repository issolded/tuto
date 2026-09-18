import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

import Opening from './screens/Opening'
import ParentLogin from './screens/ParentLogin'
import ParentSignup from './screens/ParentSignup'
import ParentDashboard from './screens/ParentDashboard'
import ChildPin from './screens/ChildPin'
import ChildHome from './screens/ChildHome'
import MyTree from './screens/MyTree'
import ReadingFlow from './screens/ReadingFlow'
import StoriesScreen from './screens/StoriesScreen'
import GoalsScreen from './screens/GoalsScreen'
import GemsScreen from './screens/GemsScreen'
import LibraryScreen from './screens/LibraryScreen'
import ParentOnboarding from './screens/ParentOnboarding'
import ParentChildDetail from './screens/ParentChildDetail'
import MathScreen from './screens/MathScreen'
import MathLab from './screens/MathLab'
// Loaded only when the page is opened. It is a developer page no child reaches, and it pulls
// the whole puzzle engine and its font gate with it — none of which belongs in the bundle every
// child downloads to open their home screen.
const PuzzleLab = lazy(() => import('./screens/PuzzleLab'))
// Lazy for the same reason as the lab: the engine and its emoji drawings are ~500KB that no other
// screen needs.
const PuzzleScreen = lazy(() => import('./screens/PuzzleScreen'))
import FamilySetup from './screens/FamilySetup'
import TaskSettings from './screens/TaskSettings'
import HomeworkScreen from './screens/HomeworkScreen'
import DrawingsScreen from './screens/DrawingsScreen'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#1A1A2E', color:'#FFD93D', fontSize:48 }}>
      ✨
    </div>
  )

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Opening />} />
        <Route path="/parent/login" element={<ParentLogin />} />
        <Route path="/parent/signup" element={<ParentSignup />} />
        <Route path="/parent/dashboard"   element={session ? <ParentDashboard />   : <Navigate to="/parent/login" />} />
        <Route path="/parent/onboarding" element={session ? <ParentOnboarding /> : <Navigate to="/parent/login" />} />
        <Route path="/parent/child/:id" element={session ? <ParentChildDetail /> : <Navigate to="/parent/login" />} />
        <Route path="/parent/child/:id/settings" element={session ? <TaskSettings /> : <Navigate to="/parent/login" />} />
        <Route path="/setup" element={<FamilySetup />} />
        <Route path="/child" element={<ChildPin />} />
        <Route path="/child/home" element={<ChildHome />} />
        <Route path="/child/task" element={<MyTree />} />
        <Route path="/child/math" element={<MathScreen />} />
        <Route path="/math-lab" element={<MathLab />} />
        <Route path="/puzzle-lab" element={<Suspense fallback={null}><PuzzleLab /></Suspense>} />
        <Route path="/child/stories" element={<StoriesScreen />} />
        <Route path="/child/homework" element={<HomeworkScreen />} />
        <Route path="/child/drawings" element={<DrawingsScreen />} />
        <Route path="/child/puzzle" element={<Suspense fallback={null}><PuzzleScreen /></Suspense>} />
        <Route path="/child/goals" element={<GoalsScreen />} />
        <Route path="/child/gems" element={<GemsScreen />} />
        <Route path="/child/reading" element={<ReadingFlow />} />
        <Route path="/child/library" element={<LibraryScreen />} />
      </Routes>
    </BrowserRouter>
  )
}
