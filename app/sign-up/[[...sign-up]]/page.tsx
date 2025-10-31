import { SignUp } from "@clerk/nextjs"

export default function SignUpPage() {
  // Note: Clerk will handle redirect based on middleware logic
  // We use a catch-all redirect URL that will be handled by middleware
  return (
    <div className="min-h-screen bg-[#161210] flex items-center justify-center">
      <SignUp
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "bg-[#161210] border border-white/10",
          },
        }}
        // Let middleware handle the redirect logic
        afterSignInUrl="/dashboard"
        afterSignUpUrl="/dashboard"
      />
    </div>
  )
}
