import { useCardGame } from '@/hooks/use-card-game'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function CardGamePage() {
  const {
    currentPair,
    currentIndex,
    isFlipped,
    hasSeenBack,
    correctCount,
    wrongCount,
    gameStarted,
    gameFinished,
    loading,
    error,
    startGame,
    flipCard,
    markAnswer,
    resetGame,
    wordPairs,
  } = useCardGame()

  const totalCards = wordPairs.length
  // Progress only increases after answering (currentIndex + 1), not when flipping
  const progress = totalCards > 0 ? ((currentIndex + 1) / totalCards) * 100 : 0

  const handleStartNewGame = async () => {
    resetGame()
    await startGame()
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Card Game</CardTitle>
          <CardDescription>
            Study word pairs by flipping cards. Click the card to see the translation, then mark if you knew it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-lg">
              <p className="font-semibold">Error</p>
              <p>{error.message}</p>
            </div>
          )}

          {!gameStarted && !loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-6">
                Click "Start Game" to begin studying your word pairs!
              </p>
              <Button onClick={startGame} size="lg" disabled={loading}>
                {loading ? 'Loading...' : 'Start Game'}
              </Button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading word pairs...</p>
            </div>
          )}

          {gameStarted && !gameFinished && currentPair && (
            <div className="space-y-6">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Progress</span>
                  <span>{currentIndex + 1} / {totalCards}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Statistics */}
              <div className="flex gap-4 justify-center">
                <div className="px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <span className="text-sm text-muted-foreground">Correct: </span>
                  <span className="font-semibold text-green-700 dark:text-green-400">{correctCount}</span>
                </div>
                <div className="px-4 py-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <span className="text-sm text-muted-foreground">Wrong: </span>
                  <span className="font-semibold text-red-700 dark:text-red-400">{wrongCount}</span>
                </div>
              </div>

              {/* Card */}
              <div className="flex justify-center">
                <div
                  className="relative w-full max-w-md h-64"
                  style={{ perspective: '1000px' }}
                  onClick={flipCard}
                >
                  <div
                    className="relative w-full h-full cursor-pointer"
                    style={{
                      transformStyle: 'preserve-3d',
                      transition: 'transform 0.6s',
                      transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    }}
                  >
                    {/* Front of card */}
                    <div
                      className="absolute w-full h-full rounded-lg border-2 shadow-lg flex items-center justify-center p-6 bg-card text-card-foreground border-border"
                      style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        transform: 'rotateY(0deg)',
                      }}
                    >
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-2">Word</p>
                        <p className="text-3xl font-bold">{currentPair.word1}</p>
                        <p className="text-xs text-muted-foreground mt-4">Click to flip</p>
                      </div>
                    </div>

                    {/* Back of card */}
                    <div
                      className="absolute w-full h-full rounded-lg border-2 shadow-lg flex items-center justify-center p-6 bg-primary text-primary-foreground border-primary"
                      style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                      }}
                    >
                      <div className="text-center">
                        <p className="text-sm opacity-80 mb-2">Translation</p>
                        <p className="text-3xl font-bold">{currentPair.word2}</p>
                        {currentPair.description && (
                          <p className="text-sm opacity-70 mt-4">{currentPair.description}</p>
                        )}
                        <p className="text-xs opacity-60 mt-4">Click to flip back</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {hasSeenBack && (
                <div className="flex gap-4 justify-center">
                  <Button
                    variant="destructive"
                    size="lg"
                    onClick={() => markAnswer(false)}
                    className="px-8"
                  >
                    No
                  </Button>
                  <Button
                    size="lg"
                    onClick={() => markAnswer(true)}
                    className="px-8 bg-green-600 hover:bg-green-700"
                  >
                    Yes
                  </Button>
                </div>
              )}
            </div>
          )}

          {gameFinished && (
            <div className="space-y-6">
              <div className="text-center py-8">
                <h2 className="text-2xl font-bold mb-4">Game Finished!</h2>
                <div className="space-y-4">
                  <div className="flex gap-4 justify-center">
                    <div className="px-6 py-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <span className="text-sm text-muted-foreground">Correct: </span>
                      <span className="text-2xl font-bold text-green-700 dark:text-green-400">{correctCount}</span>
                    </div>
                    <div className="px-6 py-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                      <span className="text-sm text-muted-foreground">Wrong: </span>
                      <span className="text-2xl font-bold text-red-700 dark:text-red-400">{wrongCount}</span>
                    </div>
                  </div>
                  <div className="text-lg">
                    <span className="text-muted-foreground">Accuracy: </span>
                    <span className="font-semibold">
                      {totalCards > 0
                        ? Math.round((correctCount / totalCards) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex justify-center">
                <Button onClick={handleStartNewGame} size="lg">
                  New Game
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
