import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold tracking-tight">
          justtoday
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Study one day at a time.
        </p>

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
          className="mt-8"
        >
          <Button type="submit" size="lg" className="w-full">
            Continue with Google
          </Button>
        </form>
      </div>
    </main>
  );
}
