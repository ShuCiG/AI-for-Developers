import { useState, useRef, useCallback } from "react"
import { useUser } from "@/contexts/UserContext"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { IconDotsVertical, IconEdit, IconTrash, IconSparkles, IconBrain } from "@tabler/icons-react"
import { useWordPairs, useWordPairMutations } from "@/hooks/use-word-pairs"
import { generateExampleSentences, classifyDifficulty, type DifficultyClassificationResponse } from "@/lib/ai-service"

export default function WordPairsPage() {
  const { user } = useUser()
  const {
    wordPairs,
    loading,
    currentPage,
    totalPages,
    totalCount,
    goToNextPage,
    goToPreviousPage,
    refresh,
  } = useWordPairs()

  const {
    createWordPair,
    updateWordPair,
    deleteWordPair,
    loading: mutationLoading,
    error: mutationError,
  } = useWordPairMutations()

  const [selectedPair, setSelectedPair] = useState<any>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isExamplesDialogOpen, setIsExamplesDialogOpen] = useState(false)
  const [exampleSentences, setExampleSentences] = useState<string[] | null>(null)
  const [loadingSentences, setLoadingSentences] = useState(false)
  const [selectedPairForExamples, setSelectedPairForExamples] = useState<any>(null)
  const [examplesError, setExamplesError] = useState<string | null>(null)
  const [isClassificationDialogOpen, setIsClassificationDialogOpen] = useState(false)
  const [difficultyClassification, setDifficultyClassification] = useState<DifficultyClassificationResponse | null>(null)
  const [loadingClassification, setLoadingClassification] = useState(false)
  const [selectedPairForClassification, setSelectedPairForClassification] = useState<any>(null)
  const [classificationError, setClassificationError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    word1: "",
    word2: "",
    description: "",
  })

  // Column widths state
  const [columnWidths, setColumnWidths] = useState({
    word1: 150,
    word2: 150,
    description: 200,
    actions: 120,
  })

  // Resizing state
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)
  const resizeStartX = useRef<number>(0)
  const resizeStartWidth = useRef<number>(0)

  const handleResizeStart = useCallback((column: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = columnWidths[column as keyof typeof columnWidths]
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault()
      const diff = moveEvent.clientX - startX
      const newWidth = Math.max(100, startWidth + diff)
      setColumnWidths((prev) => ({
        ...prev,
        [column]: newWidth,
      }))
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setResizingColumn(null)
    }

    setResizingColumn(column)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [columnWidths])

  const handleCreate = async () => {
    if (!user?.id) {
      console.error("User not authenticated")
      return
    }

    const newPair = {
      user_id: user.id,
      word1: formData.word1,
      word2: formData.word2,
      description: formData.description,
    }

    const result = await createWordPair(newPair)
    if (result) {
      setIsCreateDialogOpen(false)
      setFormData({ word1: "", word2: "", description: "" })
      refresh()
    }
  }

  const handleUpdate = async () => {
    const result = await updateWordPair(selectedPair.id, {
      word1: formData.word1,
      word2: formData.word2,
      description: formData.description,
    })
    if (result) {
      setIsEditDialogOpen(false)
      setSelectedPair(null)
      setFormData({ word1: "", word2: "", description: "" })
      refresh()
    }
  }

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this word pair?")) {
      const success = await deleteWordPair(id)
      if (success) {
        refresh()
      }
    }
  }

  const openEditDialog = (pair: any) => {
    setSelectedPair(pair)
    setFormData({
      word1: pair.word1,
      word2: pair.word2,
      description: pair.description || "",
    })
    setIsEditDialogOpen(true)
  }

  const handleGenerateExamples = async (pair: any) => {
    setSelectedPairForExamples(pair)
    setExampleSentences(null)
    setExamplesError(null)
    setLoadingSentences(true)
    setIsExamplesDialogOpen(true)

    try {
      const result = await generateExampleSentences(pair.word1, pair.word2)
      setExampleSentences(result.sentences)
    } catch (error) {
      setExamplesError(error instanceof Error ? error.message : "Failed to generate example sentences")
    } finally {
      setLoadingSentences(false)
    }
  }

  const handleClassifyDifficulty = async (pair: any) => {
    setSelectedPairForClassification(pair)
    setDifficultyClassification(null)
    setClassificationError(null)
    setLoadingClassification(true)
    setIsClassificationDialogOpen(true)

    try {
      const result = await classifyDifficulty(pair.word1, pair.word2)
      setDifficultyClassification(result)
    } catch (error) {
      setClassificationError(error instanceof Error ? error.message : "Failed to classify difficulty")
    } finally {
      setLoadingClassification(false)
    }
  }

  const getDifficultyBadgeVariant = (difficulty: string) => {
    const lower = difficulty.toLowerCase()
    if (lower === "beginner") return "default"
    if (lower === "intermediate") return "secondary"
    return "destructive"
  }

  const getDifficultyBadgeColor = (difficulty: string) => {
    const lower = difficulty.toLowerCase()
    if (lower === "beginner") return "bg-green-100 text-green-800 border-green-300"
    if (lower === "intermediate") return "bg-yellow-100 text-yellow-800 border-yellow-300"
    return "bg-red-100 text-red-800 border-red-300"
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Word Pairs</CardTitle>
            <CardDescription>
              Manage your word pairs for generating creative phrases
            </CardDescription>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>Create Word Pair</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Word Pair</DialogTitle>
                <DialogDescription>
                  Add a new word pair to your collection
                </DialogDescription>
              </DialogHeader>
              <FieldGroup>
                <Field>
                  <FieldLabel>First Word</FieldLabel>
                  <Input
                    value={formData.word1}
                    onChange={(e) => setFormData({ ...formData, word1: e.target.value })}
                    placeholder="Enter first word"
                  />
                </Field>
                <Field>
                  <FieldLabel>Second Word</FieldLabel>
                  <Input
                    value={formData.word2}
                    onChange={(e) => setFormData({ ...formData, word2: e.target.value })}
                    placeholder="Enter second word"
                  />
                </Field>
                <Field>
                  <FieldLabel>Description (Optional)</FieldLabel>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter description"
                  />
                </Field>
                {mutationError && (
                  <FieldError>{mutationError}</FieldError>
                )}
              </FieldGroup>
              <DialogFooter>
                <Button
                  onClick={handleCreate}
                  disabled={mutationLoading || !formData.word1 || !formData.word2}
                >
                  {mutationLoading ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Loading word pairs...</div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table className="min-w-full" style={{ tableLayout: 'fixed', width: '100%' }}>
                  <TableHeader>
                    <TableRow>
                      <TableHead 
                        style={{ width: `${columnWidths.word1}px`, minWidth: `${columnWidths.word1}px`, maxWidth: `${columnWidths.word1}px` }}
                        className="relative select-none"
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span className="truncate">First Word</span>
                          <div
                            className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors z-10"
                            onMouseDown={(e) => handleResizeStart('word1', e)}
                            style={{ userSelect: 'none' }}
                          />
                        </div>
                      </TableHead>
                      <TableHead 
                        style={{ width: `${columnWidths.word2}px`, minWidth: `${columnWidths.word2}px`, maxWidth: `${columnWidths.word2}px` }}
                        className="relative select-none"
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span className="truncate">Second Word</span>
                          <div
                            className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors z-10"
                            onMouseDown={(e) => handleResizeStart('word2', e)}
                            style={{ userSelect: 'none' }}
                          />
                        </div>
                      </TableHead>
                      <TableHead 
                        style={{ width: `${columnWidths.description}px`, minWidth: `${columnWidths.description}px`, maxWidth: `${columnWidths.description}px` }}
                        className="relative select-none"
                      >
                        <div className="flex items-center justify-between pr-2">
                          <span className="truncate">Description</span>
                          <div
                            className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors z-10"
                            onMouseDown={(e) => handleResizeStart('description', e)}
                            style={{ userSelect: 'none' }}
                          />
                        </div>
                      </TableHead>
                      <TableHead 
                        style={{ width: `${columnWidths.actions}px`, minWidth: `${columnWidths.actions}px`, maxWidth: `${columnWidths.actions}px` }}
                        className="text-right sticky right-0 bg-background z-20 relative select-none shadow-[inset_1px_0_0_0_hsl(var(--border))]"
                      >
                        <div className="flex items-center justify-end pr-2">
                          <span>Actions</span>
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wordPairs.map((pair) => (
                      <TableRow key={pair.id}>
                        <TableCell 
                          style={{ width: `${columnWidths.word1}px`, minWidth: `${columnWidths.word1}px`, maxWidth: `${columnWidths.word1}px` }}
                          className="overflow-hidden text-left"
                        >
                          <Badge variant="outline" className="truncate max-w-full">{pair.word1}</Badge>
                        </TableCell>
                        <TableCell 
                          style={{ width: `${columnWidths.word2}px`, minWidth: `${columnWidths.word2}px`, maxWidth: `${columnWidths.word2}px` }}
                          className="overflow-hidden text-left"
                        >
                          <Badge variant="outline" className="truncate max-w-full">{pair.word2}</Badge>
                        </TableCell>
                        <TableCell 
                          style={{ width: `${columnWidths.description}px`, minWidth: `${columnWidths.description}px`, maxWidth: `${columnWidths.description}px` }}
                          className="overflow-hidden text-left text-ellipsis whitespace-nowrap"
                        >
                          {pair.description || "-"}
                        </TableCell>
                        <TableCell 
                          className="text-right sticky right-0 bg-background z-20 shadow-[inset_1px_0_0_0_hsl(var(--border))]" 
                          style={{ width: `${columnWidths.actions}px`, minWidth: `${columnWidths.actions}px`, maxWidth: `${columnWidths.actions}px` }}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-muted">
                                <IconDotsVertical className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(pair)}>
                                <IconEdit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleGenerateExamples(pair)}>
                                <IconSparkles className="mr-2 h-4 w-4" />
                                Generate Examples
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleClassifyDifficulty(pair)}>
                                <IconBrain className="mr-2 h-4 w-4" />
                                Classify Difficulty
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(pair.id)}
                                variant="destructive"
                              >
                                <IconTrash className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Edit Dialog - moved outside table */}
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Word Pair</DialogTitle>
                    <DialogDescription>
                      Update the word pair details
                    </DialogDescription>
                  </DialogHeader>
                  <FieldGroup>
                    <Field>
                      <FieldLabel>First Word</FieldLabel>
                      <Input
                        value={formData.word1}
                        onChange={(e) => setFormData({ ...formData, word1: e.target.value })}
                        placeholder="Enter first word"
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Second Word</FieldLabel>
                      <Input
                        value={formData.word2}
                        onChange={(e) => setFormData({ ...formData, word2: e.target.value })}
                        placeholder="Enter second word"
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Description (Optional)</FieldLabel>
                      <Input
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Enter description"
                      />
                    </Field>
                    {mutationError && (
                      <FieldError>{mutationError}</FieldError>
                    )}
                  </FieldGroup>
                  <DialogFooter>
                    <Button
                      onClick={handleUpdate}
                      disabled={mutationLoading || !formData.word1 || !formData.word2}
                    >
                      {mutationLoading ? "Updating..." : "Update"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              {wordPairs.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  No word pairs found. Create your first word pair!
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-gray-500">
                    Page {currentPage} of {totalPages} ({totalCount} total pairs)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToPreviousPage}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToNextPage}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Example Sentences Dialog */}
      <Dialog open={isExamplesDialogOpen} onOpenChange={setIsExamplesDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Example Sentences</DialogTitle>
            <DialogDescription>
              {selectedPairForExamples && (
                <>Contextual examples for <strong>{selectedPairForExamples.word1}</strong> and <strong>{selectedPairForExamples.word2}</strong></>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {loadingSentences ? (
              <div className="text-center py-4">Generating example sentences...</div>
            ) : examplesError ? (
              <div className="text-red-500 py-4">{examplesError}</div>
            ) : exampleSentences && exampleSentences.length > 0 ? (
              <div className="space-y-3">
                {exampleSentences.map((sentence, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg border">
                    <p className="text-sm">{sentence}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">No example sentences generated yet.</div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsExamplesDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Difficulty Classification Dialog */}
      <Dialog open={isClassificationDialogOpen} onOpenChange={setIsClassificationDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Difficulty Classification</DialogTitle>
            <DialogDescription>
              {selectedPairForClassification && (
                <>Difficulty assessment for <strong>{selectedPairForClassification.word1}</strong> and <strong>{selectedPairForClassification.word2}</strong></>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {loadingClassification ? (
              <div className="text-center py-4">Classifying difficulty...</div>
            ) : classificationError ? (
              <div className="text-red-500 py-4">{classificationError}</div>
            ) : difficultyClassification ? (
              <div className="space-y-4">
                {/* Word 1 Classification */}
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-medium">{difficultyClassification.word1}</span>
                    <Badge 
                      className={getDifficultyBadgeColor(difficultyClassification.difficulty1)}
                      variant="outline"
                    >
                      {difficultyClassification.difficulty1.charAt(0).toUpperCase() + difficultyClassification.difficulty1.slice(1)}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{difficultyClassification.reasoning1}</p>
                </div>

                {/* Word 2 Classification */}
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-medium">{difficultyClassification.word2}</span>
                    <Badge 
                      className={getDifficultyBadgeColor(difficultyClassification.difficulty2)}
                      variant="outline"
                    >
                      {difficultyClassification.difficulty2.charAt(0).toUpperCase() + difficultyClassification.difficulty2.slice(1)}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{difficultyClassification.reasoning2}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">No classification available yet.</div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsClassificationDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}