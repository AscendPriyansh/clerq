import { requireUser } from "@/lib/auth";
import { OnboardingForm } from "@/components/onboarding-form";

export default async function Onboarding() {
  await requireUser();
  return <main className="mx-auto w-full max-w-lg space-y-5 p-8"><h1 className="text-2xl font-semibold">Create your organisation</h1><p>Set up a workspace for your receipts and bank transactions.</p><OnboardingForm /></main>;
}
