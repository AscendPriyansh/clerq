import { AuthForm } from "@/components/auth-form";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <AuthForm mode="login" initialError={error ? "Sign-in could not be completed. Request a new link or try again." : undefined} />;
}
