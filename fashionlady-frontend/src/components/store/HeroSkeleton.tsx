import { Skeleton } from "@/components/ui/skeleton";

export function HeroSkeleton() {
  return (
    <section className="relative overflow-hidden bg-primary">
      <div className="relative h-[100dvh] w-full">
        <Skeleton className="absolute inset-0 h-full w-full rounded-none bg-secondary/40" />
        <div className="absolute inset-0 bg-gradient-to-tr from-black/45 via-black/15 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/20" />

        <div className="relative z-10 h-full container flex flex-col justify-center pt-24">
          <div className="max-w-5xl space-y-6">
            <Skeleton className="h-14 w-[90%] max-w-5xl bg-white/30" />
            <Skeleton className="h-14 w-[82%] max-w-4xl bg-white/30" />
            <Skeleton className="h-14 w-[68%] max-w-3xl bg-white/30" />

            <div className="space-y-3 pt-2">
              <Skeleton className="h-6 w-[60%] max-w-2xl bg-white/25" />
              <Skeleton className="h-6 w-[46%] max-w-xl bg-white/25" />
            </div>

            <div className="pt-4">
              <Skeleton className="h-12 w-44 rounded-none bg-white/30" />
            </div>
          </div>

          <div className="absolute bottom-10 left-0 right-0 container flex items-center justify-between">
            <div className="flex gap-3">
              <Skeleton className="h-px w-16 rounded-none bg-white/60" />
              <Skeleton className="h-px w-8 rounded-none bg-white/35" />
              <Skeleton className="h-px w-8 rounded-none bg-white/35" />
              <Skeleton className="h-px w-8 rounded-none bg-white/35" />
            </div>
            <Skeleton className="hidden md:block h-4 w-20 bg-white/30" />
          </div>
        </div>
      </div>

      <div className="border-y border-primary/10 bg-background py-4 overflow-hidden">
        <div className="container flex items-center gap-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-6 w-28" />
        </div>
      </div>
    </section>
  );
}
