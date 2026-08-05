import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Skeleton Header */}
      <div className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="container flex h-20 items-center justify-between gap-6">
          <Skeleton className="h-6 w-6 lg:hidden" />
          <Skeleton className="h-10 w-32" />
          <nav className="hidden lg:flex items-center gap-7">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </nav>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </div>
      </div>

      {/* Skeleton Page Content */}
      <main>
        {/* Banner/Hero Skeleton */}
        <section className="bg-secondary/50 border-b border-border">
          <div className="container py-12 md:py-20 space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-12 w-1/2" />
            <Skeleton className="h-6 w-1/3" />
          </div>
        </section>

        {/* Grid Skeleton */}
        <div className="container py-12 md:py-20">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 md:gap-x-6 gap-y-10">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[3/4] w-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Skeleton Footer */}
      <div className="bg-primary py-16">
        <div className="container grid grid-cols-2 lg:grid-cols-5 gap-10">
          <div className="col-span-2 space-y-6">
            <Skeleton className="h-10 w-32 bg-primary-foreground/20" />
            <Skeleton className="h-4 w-full bg-primary-foreground/10" />
            <Skeleton className="h-4 w-3/4 bg-primary-foreground/10" />
            <div className="flex gap-3">
              <Skeleton className="h-10 w-10 rounded-full bg-primary-foreground/20" />
              <Skeleton className="h-10 w-10 rounded-full bg-primary-foreground/20" />
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-6 w-24 bg-primary-foreground/20" />
            <Skeleton className="h-4 w-full bg-primary-foreground/10" />
            <Skeleton className="h-4 w-full bg-primary-foreground/10" />
            <Skeleton className="h-4 w-full bg-primary-foreground/10" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-6 w-24 bg-primary-foreground/20" />
            <Skeleton className="h-4 w-full bg-primary-foreground/10" />
            <Skeleton className="h-4 w-full bg-primary-foreground/10" />
            <Skeleton className="h-4 w-full bg-primary-foreground/10" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-6 w-24 bg-primary-foreground/20" />
            <Skeleton className="h-4 w-full bg-primary-foreground/10" />
            <Skeleton className="h-4 w-full bg-primary-foreground/10" />
            <Skeleton className="h-4 w-full bg-primary-foreground/10" />
          </div>
        </div>
      </div>
    </div>
  );
}
