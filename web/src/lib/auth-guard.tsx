import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useUser } from '@/contexts/UserContext'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useUser()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  // Show loading indicator while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!user) {
    const params = new URLSearchParams(searchParams)
    params.set('redirect', location.pathname)

    return <Navigate to={`/auth/login?${params.toString()}`} replace />
  }

  return <>{children}</>
}
