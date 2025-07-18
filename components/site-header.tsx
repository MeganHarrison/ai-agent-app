"use client"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { usePathname } from "next/navigation"

function getPageTitle(pathname: string): string {
  // Simple mapping for common routes, can be extended
  if (pathname === "/" || pathname === "") return "Chat";
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/tables/projects")) return "Projects";
  if (pathname.startsWith("/tables/documents")) return "Documents";
  if (pathname.startsWith("/tables")) return "Tables";
  if (pathname.startsWith("/api")) return "API";
  // Fallback: use last segment, capitalized
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "Home";
  return segments[segments.length - 1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function SiteHeader() {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{pageTitle}</h1>
      </div>
    </header>
  )
}
