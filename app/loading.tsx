import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center text-primary">
      <Spinner className="h-8 w-8" label="Loading" />
    </main>
  );
}
