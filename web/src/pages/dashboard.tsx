import { Link } from "react-router-dom"
import { IconMessageCircle } from "@tabler/icons-react"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

import data from "./dashboard/data.json"

export default function DashboardPage() {
  return (
    <>
      <div className="px-4 lg:px-6 pb-4">
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2 text-xl">
                <IconMessageCircle className="size-5" />
                Language Tutor Chat
              </CardTitle>
              <CardDescription>
                Ask for translations, new words, grammar, or practice. Get word cards and add them to your list.
              </CardDescription>
            </div>
            <Button asChild>
              <Link to="/chat">Open Chat</Link>
            </Button>
          </CardHeader>
        </Card>
      </div>
      <SectionCards />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>
      <div className="px-4 lg:px-6">
        <DataTable data={data} />
      </div>
    </>
  )
}
