import { signIn } from "@/lib/auth";
import { RotatingIntro } from "@/components/auth/rotating-intro";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold tracking-tight">
          justtoday
        </h1>

        <RotatingIntro />

        <div className="mt-8 space-y-3">
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <Button type="submit" size="lg" className="w-full">
              Continue with Google
            </Button>
          </form>

          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: "/" });
            }}
          >
            <Button
              type="submit"
              size="lg"
              variant="outline"
              className="w-full"
            >
              Continue with GitHub
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
