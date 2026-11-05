import { LinkButton } from "@/components/ui/button";

/** Shown inside the shell when a signed-in page calls notFound() — e.g. a document that doesn't
 *  exist in the current workspace. */
export default function AppNotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4 pb-nav pt-12">
      <div className="surface w-full max-w-md rounded-2xl p-8 text-center">
        <p className="text-overline font-semibold uppercase text-vayu-accent">Not found</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">This isn&rsquo;t in your workspace</h1>
        <p className="mt-2 text-sm leading-relaxed text-vayu-muted">
          It may have been deleted, or it belongs to a different workspace. Switch workspaces from the top bar
          if you were invited to another one.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <LinkButton href="/dashboard" variant="primary">
            Go to dashboard
          </LinkButton>
          <LinkButton href="/docs" variant="secondary">
            All documents
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
