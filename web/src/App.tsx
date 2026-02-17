import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from './components/ui/sonner'
import { UserProvider } from './contexts/UserContext'
import { UserLayout } from './layouts/UserLayout'
import { AuthLayout } from './layouts/AuthLayout'
import DashboardPage from './pages/dashboard'
import LoginPage from './pages/login'
import SignUpPage from './pages/signup'
import WordsPage from './pages/words'
import RandomPhrasePage from './pages/random-phrase'
import WordPairsPage from './pages/word-pairs'
import WordsGamePage from './pages/words-game'
import ChatPage from './pages/chat'

function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <Toaster richColors position="top-center" />
        <Routes>
          {/* Auth routes with /auth prefix */}
          <Route path="/auth" element={<AuthLayout />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="signup" element={<SignUpPage />} />
          </Route>

          {/* Dashboard routes at root */}
          <Route element={<UserLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/words" element={<WordsPage />} />
            <Route path="/random-phrase" element={<RandomPhrasePage />} />
            <Route path="/word-pairs" element={<WordPairsPage />} />
            <Route path="/words-game" element={<WordsGamePage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/chat/:chatId" element={<ChatPage />} />
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </UserProvider>
    </BrowserRouter>
  )
}

export default App
