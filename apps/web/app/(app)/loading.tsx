import { Loading, Skeleton } from "@/components/ui/feedback";
import { PageContainer } from "@/components/ui/page";

/** Generic placeholder while a server-rendered page in the app loads (pages may define their own). */
export default function AppLoading() {
  return (
    <div aria-busy="true">
      <PageContainer>
        <Loading srOnly />
        <div className="mb-8 space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl sm:col-span-2" />
        </div>
      </PageContainer>
    </div>
  );
}
