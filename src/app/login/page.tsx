import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/features/auth/login-form";

export const metadata: Metadata = {
  title: "Giriş Yap — betrix.pro",
  description: "CheckMatch.net CRM paneline admin girişi",
};

const DEFAULT_REDIRECT = "/calendar";

function resolveRedirectTarget(from: string | undefined): string {
  if (from && from.startsWith("/") && !from.startsWith("//")) return from;
  return DEFAULT_REDIRECT;
}

interface LoginPageProps {
  searchParams: Promise<{ from?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const from = typeof params.from === "string" ? params.from : undefined;
  const redirectTo = resolveRedirectTarget(from);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div
        aria-hidden
        className="pointer-events-none fixed -top-32 left-1/2 h-72 w-[50rem] -translate-x-1/2 rounded-full bg-emerald-500/[0.06] blur-[140px]"
      />

      <Card className="relative w-full max-w-sm">
        <CardHeader className="items-center gap-1.5 pb-2 text-center">
          <div className="mb-2 flex size-9 items-center justify-center rounded-md bg-emerald-500/15 text-sm font-bold text-emerald-400 ring-1 ring-emerald-500/30">
            CM
          </div>
          <CardTitle className="text-lg">CheckMatch.net</CardTitle>
          <CardDescription>betrix.pro Studio · Admin Girişi</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm redirectTo={redirectTo} />
        </CardContent>
      </Card>
    </div>
  );
}
