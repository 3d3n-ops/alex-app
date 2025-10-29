import { SignUp } from "@clerk/nextjs"

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-[#161210] flex items-center justify-center">
      <SignUp
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "bg-[#161210] border border-white/10",
          },
        }}
        afterSignInUrl="/onboarding/level"
        afterSignUpUrl="/onboarding/level"
      />
    </div>
  )
}
