import { GlowButton } from "@/components/landing/glow-button";
import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 inline-block">
          <GlowButton href="/" variant="ghost" className="px-4 py-2">
            ← Return Home
          </GlowButton>
        </div>
        <h1 className="text-4xl font-bold mb-8 tracking-tight">Terms of Service</h1>
        <div className="prose prose-invert prose-vayu max-w-none">
          <p className="text-vayu-muted mb-8">Last updated: {new Date().toLocaleDateString()}</p>
          
          <p className="mb-6 leading-relaxed text-vayu-fg">
            Welcome to VAYU AI. By accessing our platform, you agree to these terms.
          </p>
          
          <h2 className="text-2xl font-semibold mt-10 mb-4 text-white">1. Acceptance of Terms</h2>
          <p className="mb-6 leading-relaxed text-vayu-fg">
            By using our services, you agree to be bound by these Terms of Service and all applicable laws and regulations.
          </p>
          
          <h2 className="text-2xl font-semibold mt-10 mb-4 text-white">2. Use License</h2>
          <p className="mb-6 leading-relaxed text-vayu-fg">
            Permission is granted to temporarily use the materials on VAYU AI's website for personal, non-commercial transitory viewing only.
          </p>
          
          <h2 className="text-2xl font-semibold mt-10 mb-4 text-white">3. Disclaimer</h2>
          <p className="mb-6 leading-relaxed text-vayu-fg">
            The materials on VAYU AI's website are provided on an 'as is' basis. VAYU AI makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
          </p>
        </div>
      </div>
    </main>
  );
}
