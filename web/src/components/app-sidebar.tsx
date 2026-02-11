import * as React from "react"
import { Link } from "react-router-dom"
import {
  IconDashboard,
  IconDatabase,
  IconInnerShadowTop,
  IconPuzzle,
  IconSparkles,
} from "@tabler/icons-react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useUser } from "@/contexts/UserContext"

const data = {
  user: {
    name: "Guest",
    email: "guest@example.com",
    avatar: "",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
    },
  ],
  documents: [
    {
      name: "Words",
      url: "/words",
      icon: IconDatabase,
    },
    {
      name: "Word Pairs",
      url: "/word-pairs",
      icon: IconDatabase,
    },
    {
      name: "Random Phrase",
      url: "/random-phrase",
      icon: IconSparkles,
    },
    {
      name: "Words game",
      url: "/words-game",
      icon: IconPuzzle,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useUser()

  const userData = user ? {
    name: user.email?.split('@')[0] || 'User',
    email: user.email || '',
    avatar: user.user_metadata?.avatar_url || '',
  } : data.user

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link to="/dashboard">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">Acme Inc.</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments items={data.documents} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  )
}
