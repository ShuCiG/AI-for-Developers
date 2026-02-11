import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useWordsGame } from '@/hooks/use-words-game'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const PLACEHOLDER = '___'

function parseTextWithPlaceholders(text: string): { segments: string[]; slotCount: number } {
  const parts = text.split(PLACEHOLDER)
  const slotCount = parts.length - 1
  return { segments: parts, slotCount }
}

function DraggableWord({
  word,
  isInSlot,
}: {
  word: string
  isInSlot: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: word,
    data: { word },
  })

  if (isInSlot) return null

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="inline-flex"
    >
      <Badge
        variant="secondary"
        className={cn(
          'cursor-grab active:cursor-grabbing px-4 py-2 text-base font-semibold shadow-sm',
          'border-2 border-border hover:border-primary/50',
          'transition-all hover:shadow-md',
          isDragging && 'invisible'
        )}
      >
        {word}
      </Badge>
    </div>
  )
}

function DroppableSlot({
  slotId,
  placedWord,
}: {
  slotId: string
  placedWord: string | null
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: slotId,
    data: { slotId },
  })

  const hasContent = placedWord || isOver

  return (
    <span
      ref={setNodeRef}
      className={cn(
        'inline-flex min-w-[80px] items-center justify-center py-1 transition-colors',
        !hasContent && 'rounded border-2 border-dashed border-muted-foreground/30 bg-muted/30 px-2 hover:bg-muted/50'
      )}
    >
      {placedWord ? (
        <Badge variant="secondary" className="px-3 py-1 font-semibold shadow-sm">
          {placedWord}
        </Badge>
      ) : (
        isOver ? '...' : ''
      )}
    </span>
  )
}

export default function WordsGamePage() {
  const {
    textWithPlaceholders,
    wordsInOrder,
    words,
    loading,
    error,
    startGame,
    checkAnswer,
  } = useWordsGame()

  const [placements, setPlacements] = useState<Record<string, string>>({})
  const [checkResult, setCheckResult] = useState<'correct' | 'wrong' | null>(null)
  const [activeWord, setActiveWord] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 5 } })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveWord(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveWord(null)
    const { active, over } = event
    if (!over) return

    const word = active.id as string
    const slotId = over.id as string

    if (!slotId.startsWith('slot-')) return

    setPlacements((prev) => {
      const next = { ...prev }
      for (const [s, w] of Object.entries(next)) {
        if (w === word) delete next[s]
      }
      next[slotId] = word
      return next
    })
    setCheckResult(null)
  }

  const handleCheckAnswer = () => {
    const isCorrect = checkAnswer(placements)
    setCheckResult(isCorrect ? 'correct' : 'wrong')
  }

  const handleNewGame = () => {
    setPlacements({})
    setCheckResult(null)
    startGame()
  }

  const { segments, slotCount } = textWithPlaceholders
    ? parseTextWithPlaceholders(textWithPlaceholders)
    : { segments: [], slotCount: 0 }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Words Game</CardTitle>
            <CardDescription>
              Drag the words to the correct places in the text, then check your answer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!textWithPlaceholders && !loading && (
              <div className="flex flex-col items-center gap-4 py-12">
                <p className="text-muted-foreground text-center">
                  Click &quot;New game&quot; to start
                </p>
                <Button size="lg" onClick={handleNewGame}>
                  New game
                </Button>
              </div>
            )}

            {loading && (
              <div className="space-y-4 py-8">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-4/5" />
                <Skeleton className="h-6 w-3/4" />
                <div className="flex gap-2 pt-4">
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-10 w-24" />
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
                <p className="text-destructive font-medium">{error.message}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={handleNewGame}>
                  Try again
                </Button>
              </div>
            )}

            {textWithPlaceholders && !loading && !error && (
              <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={() => setActiveWord(null)}
              >
                <div className="space-y-6">
                  <div className="rounded-lg border bg-muted/50 p-6">
                    <p className="text-lg leading-relaxed">
                      {segments.map((segment, i) => (
                        <span key={i}>
                          {segment}
                          {i < slotCount && (
                            <DroppableSlot
                              slotId={`slot-${i}`}
                              placedWord={placements[`slot-${i}`] ?? null}
                            />
                          )}
                        </span>
                      ))}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-3">Words:</h3>
                    <div className="flex flex-wrap gap-2">
                      {words.map((word) => (
                        <DraggableWord
                          key={word}
                          word={word}
                          isInSlot={Object.values(placements).includes(word)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <Button
                      size="lg"
                      onClick={handleCheckAnswer}
                      disabled={
                        Object.keys(placements).length !== wordsInOrder.length
                      }
                    >
                      Check answer
                    </Button>

                    {checkResult !== null && (
                      <div
                        className={cn(
                          'rounded-lg border-2 p-4 text-center text-lg font-semibold',
                          checkResult === 'correct'
                            ? 'border-green-500 bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200'
                            : 'border-red-500 bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
                        )}
                      >
                        {checkResult === 'correct' ? 'Correct' : 'Wrong'}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setPlacements({})
                          setCheckResult(null)
                        }}
                        disabled={Object.keys(placements).length === 0}
                      >
                        Reset
                      </Button>
                      <Button variant="outline" onClick={handleNewGame}>
                        New game
                      </Button>
                    </div>
                  </div>
                </div>
                <DragOverlay>
                  {activeWord ? (
                    <Badge
                      variant="secondary"
                      className="cursor-grabbing border-2 border-primary bg-primary/10 px-4 py-2 text-base font-semibold shadow-lg ring-2 ring-primary/20"
                    >
                      {activeWord}
                    </Badge>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
