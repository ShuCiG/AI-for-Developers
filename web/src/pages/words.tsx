import { useWords } from '@/hooks/use-words'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { IconChevronUp, IconChevronDown } from '@tabler/icons-react'

type SortColumn = 'id' | 'word' | 'created_at'

interface SortableHeaderProps {
  column: SortColumn
  label: string
  currentSortBy: SortColumn
  currentSortOrder: 'asc' | 'desc'
  onSort: (column: SortColumn) => void
  className?: string
}

function SortableHeader({
  column,
  label,
  currentSortBy,
  currentSortOrder,
  onSort,
  className,
}: SortableHeaderProps) {
  const isActive = currentSortBy === column
  const Icon = currentSortOrder === 'asc' ? IconChevronUp : IconChevronDown
  const isRightAligned = className?.includes('text-right')

  return (
    <TableHead className={className}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSort(column)}
        className={`h-auto p-0 font-medium hover:bg-transparent ${isRightAligned ? 'ml-auto' : ''}`}
      >
        <span className={`flex items-center gap-2 ${isRightAligned ? 'flex-row-reverse' : ''}`}>
          {label}
          {isActive && <Icon size={16} className="text-muted-foreground" />}
        </span>
      </Button>
    </TableHead>
  )
}

export default function WordsPage() {
  const {
    words,
    loading,
    currentPage,
    totalPages,
    totalCount,
    sortBy,
    sortOrder,
    setSorting,
    goToNextPage,
    goToPreviousPage,
  } = useWords()

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Words</CardTitle>
          <CardDescription>
            All words from the database (showing {words.length} of {totalCount} words)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Loading words...</p>
            </div>
          ) : words.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">No words found</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader
                        column="id"
                        label="ID"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSort={setSorting}
                        className="w-[100px]"
                      />
                      <SortableHeader
                        column="word"
                        label="Word"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSort={setSorting}
                      />
                      <SortableHeader
                        column="created_at"
                        label="Created At"
                        currentSortBy={sortBy}
                        currentSortOrder={sortOrder}
                        onSort={setSorting}
                        className="text-right"
                      />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {words.map((word) => (
                      <TableRow key={word.id}>
                        <TableCell className="font-mono text-xs">
                          {word.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="font-medium">{word.word}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatDate(word.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between px-2 py-4">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
