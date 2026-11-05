import { Loading, Skeleton } from "@/components/ui/feedback";
import { PageContainer } from "@/components/ui/page";

export default function DocsLoading() {
  return (
    <div aria-busy="true">
      <PageContainer size="narrow">
        <Loading srOnly label="Loading documents…" />
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[66px] rounded-xl" />
          ))}
        </div>
      </PageContainer>
    </div>
  );
}
