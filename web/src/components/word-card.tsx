import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { WordCardPayload } from '@/lib/ai-service'

interface WordCardProps extends WordCardPayload {
  onSave?: (word: string, translation: string, example?: string) => void
  saved?: boolean
}

export function WordCard({
  word,
  translation,
  example_sentence,
  definition,
  onSave,
  saved = false,
}: WordCardProps) {
  const handleSave = () => {
    if (onSave && !saved) {
      onSave(word, translation, example_sentence)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardContent className="pt-6 space-y-4">
        <div className="space-y-2">
          <div className="font-semibold text-2xl">{word}</div>
          <div className="text-lg text-muted-foreground">{translation}</div>
        </div>

        {example_sentence && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground italic">"{example_sentence}"</p>
          </div>
        )}

        {definition && (
          <div className="pt-2">
            <p className="text-sm">{definition}</p>
          </div>
        )}

        {onSave && (
          <div className="pt-4">
            <Button
              onClick={handleSave}
              disabled={saved}
              variant="outline"
              className="w-full"
            >
              {saved ? 'In your list' : 'Add to my list'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
