import { useState, useCallback } from 'react'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  BarVisualizer,
  VoiceAssistantControlBar,
} from '@livekit/components-react'
import '@livekit/components-styles'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

const AI_URL = import.meta.env.VITE_AI_SERVICE_URL || ''

interface ConnectionDetails {
  token: string
  url: string
}

function GameRoom({ onDisconnect }: { onDisconnect: () => void }) {
  const { state, audioTrack } = useVoiceAssistant()

  const stateLabel: Record<string, string> = {
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    initializing: 'Starting...',
    listening: 'Listening...',
    thinking: 'Thinking...',
    speaking: 'Speaking...',
  }

  return (
    <div className="flex flex-col items-center gap-8 py-8">
      <div className="flex flex-col items-center gap-3">
        <div className="w-64 h-24">
          <BarVisualizer
            state={state}
            barCount={7}
            trackRef={audioTrack}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
        <p className="text-sm text-muted-foreground font-medium">
          {stateLabel[state] ?? state}
        </p>
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-muted-foreground text-sm max-w-sm">
          Speak your answer when the agent asks. Say <span className="font-medium">"stop"</span> or{' '}
          <span className="font-medium">"I'm done"</span> to end the game.
        </p>
      </div>

      <VoiceAssistantControlBar />

      <Button variant="outline" onClick={onDisconnect}>
        Leave Game
      </Button>

      <RoomAudioRenderer />
    </div>
  )
}

export default function VoiceGamePage() {
  const [connectionDetails, setConnectionDetails] = useState<ConnectionDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStartGame = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('You must be logged in to play')
      }

      const res = await fetch(`${AI_URL}/api/livekit/token`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `Server error: ${res.status}`)
      }

      const details: ConnectionDetails = await res.json()
      setConnectionDetails(details)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleDisconnect = useCallback(() => {
    setConnectionDetails(null)
  }, [])

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Voice Word Game</CardTitle>
          <CardDescription>
            Practice your vocabulary by speaking! The AI tutor will say a word and you respond with
            the translation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-lg">
              <p className="font-semibold">Error</p>
              <p>{error}</p>
            </div>
          )}

          {!connectionDetails ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <p className="text-muted-foreground text-center max-w-sm">
                Connect your microphone and start a voice conversation with your AI language tutor.
                The agent will quiz you on your saved word pairs.
              </p>
              <Button onClick={handleStartGame} size="lg" disabled={loading}>
                {loading ? 'Connecting...' : 'Start Game'}
              </Button>
            </div>
          ) : (
            <LiveKitRoom
              token={connectionDetails.token}
              serverUrl={connectionDetails.url}
              connect={true}
              audio={true}
              video={false}
              onDisconnected={handleDisconnect}
            >
              <GameRoom onDisconnect={handleDisconnect} />
            </LiveKitRoom>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
