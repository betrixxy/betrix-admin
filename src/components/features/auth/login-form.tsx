"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type LoginActionState } from "@/app/login/actions";

const initialState: LoginActionState = {};

interface LoginFormProps {
  redirectTo: string;
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="redirectTo" value={redirectTo} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-posta</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="admin@checkmatch.net"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Şifre</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
      </div>

      {state.error && (
        <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-2 text-sm text-destructive">
          <AlertCircle className="size-3.5 shrink-0" />
          {state.error}
        </div>
      )}

      <Button type="submit" size="lg" className="mt-1 w-full" disabled={isPending}>
        {isPending ? "Giriş yapılıyor…" : "Giriş Yap"}
      </Button>
    </form>
  );
}
