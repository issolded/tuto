import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

import Opening from './screens/Opening'
import ParentLogin from './screens/ParentLogin'
import ParentSignup from './screens/ParentSignup'
import ParentDashboard from './screens/ParentDashboard'
import ChildPin from './screens/ChildPin'
import ChildHome from './screens/ChildHome'
import TaskFlow from './screens/TaskFlow'
import ReadingFlow from './screens/ReadingFlow'
import StoriesScreen from './screens/StoriesScreen'
import GoalsScreen from './screens/GoalsScreen'
import GemsScreen from './screens/GemsScreen'
import LibraryScreen from './screens/LibraryScreen'
import ParentOnboarding from './screens/ParentOnboarding'
import ParentChildDetail from './screens/ParentChildDetail'
import MathScreen from './screens/MathScreen'

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
        <Route path="/child" element={<ChildPin />} />
        <Route path="/child/home" element={<ChildHome />} />
        <Route path="/child/task" element={<TaskFlow />} />
        <Route path="/child/math" element={<MathScreen />} />
        <Route path="/child/stories" element={<StoriesScreen />} />
        <Route path="/child/goals" element={<GoalsScreen />} />
        <Route path="/child/gems" element={<GemsScreen />} />
        <Route path="/child/reading" element={<ReadingFlow />} />
        <Route path="/child/library" element={<LibraryScreen />} />
      </Routes>
    </BrowserRouter>
  )
}
