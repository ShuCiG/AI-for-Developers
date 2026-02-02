import { useEffect, useState } from 'react'
import { useRandomPhrase } from '@/hooks/use-random-phrase'
import { useWordPairs } from '@/hooks/use-word-pairs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function RandomPhrasePage() {
  const { phrase, words, wordPair, loading, error, generatePhrase, generatePhraseFromPair } = useRandomPhrase()
  const { wordPairs } = useWordPairs()
  const [selectedMode, setSelectedMode] = useState<'random' | 'pair'>('random')
  const [selectedPairId, setSelectedPairId] = useState<string>('')

  // Generate initial phrase on component mount
  useEffect(() => {
    generatePhrase()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleModeChange = (mode: 'random' | 'pair') => {
    setSelectedMode(mode)
  }

  const handlePairChange = (pairId: string) => {
    setSelectedPairId(pairId)
    if (pairId) {
      generatePhraseFromPair(pairId)
    } else {
      generatePhrase()
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Phrase Generator</CardTitle>
            <CardDescription>
              Generate creative phrases using random words or your custom word pairs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Mode Selection */}
            <div>
              <div className="flex gap-2 mb-3">
                <Button
                  variant={selectedMode === 'random' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleModeChange('random')}
                >
                  Random Words
                </Button>
                <Button
                  variant={selectedMode === 'pair' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleModeChange('pair')}
                >
                  Word Pairs
                </Button>
              </div>
              
              {selectedMode === 'pair' && (
                <div className="mb-3">
                  <Select value={selectedPairId} onValueChange={handlePairChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a word pair" />
                    </SelectTrigger>
                    <SelectContent>
                      {wordPairs.map((pair) => (
                        <SelectItem key={pair.id} value={pair.id}>
                          {pair.word1} + {pair.word2}
                          {pair.description && (
                            <span className="text-muted-foreground text-xs ml-2">
                              ({pair.description})
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Source Words Section */}
            <div>
              <h3 className="text-sm font-medium mb-3">
                {selectedMode === 'random' ? 'Selected Words:' : 'Word Pair:'}
              </h3>
              <div className="flex gap-2 flex-wrap">
                {loading && words.length === 0 ? (
                  <>
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-20" />
                  </>
                ) : (
                  words.map((word) => (
                    <Badge key={word.id} variant="secondary" className="text-base px-3 py-1">
                      {word.word}
                    </Badge>
                  ))
                )}
              </div>
              
              {wordPair && selectedMode === 'pair' && (
                <div className="mt-2 text-sm text-muted-foreground">
                  {wordPair.description && (
                    <p>Description: {wordPair.description}</p>
                  )}
                </div>
              )}
            </div>

            {/* Generated Phrase Section */}
            <div>
              <h3 className="text-sm font-medium mb-3">Generated Phrase:</h3>
              <div className="rounded-lg border bg-muted/50 p-6 min-h-[120px] flex items-center justify-center">
                {loading ? (
                  <div className="space-y-2 w-full">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                ) : error ? (
                  <div className="text-center space-y-2">
                    <p className="text-destructive font-medium">Error generating phrase</p>
                    <p className="text-sm text-muted-foreground">{error.message}</p>
                  </div>
                ) : phrase ? (
                  <p className="text-lg text-center leading-relaxed">{phrase}</p>
                ) : (
                  <p className="text-muted-foreground text-center">
                    Click "Generate New Phrase" to start
                  </p>
                )}
              </div>
            </div>

            {/* Action Button */}
            <div className="flex justify-center pt-4">
              <Button
                size="lg"
                onClick={selectedMode === 'random' ? generatePhrase : () => generatePhraseFromPair(selectedPairId)}
                disabled={loading || (selectedMode === 'pair' && !selectedPairId)}
              >
                {loading ? 'Generating...' : 
                 selectedMode === 'random' ? 'Generate New Phrase' : 
                 'Generate from Selected Pair'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-muted">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Random Mode:</strong> This feature pulls three random words from the database 
                and uses AI to create a creative phrase that incorporates all three words.
              </p>
              <p>
                <strong>Word Pair Mode:</strong> This feature uses your selected word pair to generate 
                a creative phrase. You can manage your word pairs in the Word Pairs section.
              </p>
              <p>
                Each generation is personalized based on your user profile context for a unique
                experience.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
