import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import DashboardClient from "@/components/dashboard-client"

export default async function DashboardPage() {
  const { userId } = await auth()
  const user = await currentUser()

  if (!userId) {
    redirect("/sign-in")
  }

  // Check if onboarding is completed, if not redirect to onboarding
  const onboardingCompleted = Boolean(user?.publicMetadata?.onboardingCompleted)
  if (!onboardingCompleted) {
    redirect("/onboarding/level")
  }

  const firstName = user?.firstName || "there"

  return <DashboardClient firstName={firstName} />
}
