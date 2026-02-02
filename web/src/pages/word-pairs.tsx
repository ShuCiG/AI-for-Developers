import { useState } from "react"
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
import { useWordPairs, useWordPairMutations } from "@/hooks/use-word-pairs"

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
  const [formData, setFormData] = useState({
    word1: "",
    word2: "",
    description: "",
  })

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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>First Word</TableHead>
                    <TableHead>Second Word</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wordPairs.map((pair) => (
                    <TableRow key={pair.id}>
                      <TableCell>
                        <Badge variant="outline">{pair.word1}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{pair.word2}</Badge>
                      </TableCell>
                      <TableCell>{pair.description || "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" onClick={() => openEditDialog(pair)}>
                                Edit
                              </Button>
                            </DialogTrigger>
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(pair.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
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
    </div>
  )
}