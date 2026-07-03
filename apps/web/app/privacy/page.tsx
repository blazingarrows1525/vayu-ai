import { GlowButton } from "@/components/landing/glow-button";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 inline-block">
          <GlowButton href="/" variant="ghost" className="px-4 py-2">
            ← Return Home
          </GlowButton>
        </div>
        <h1 className="text-4xl font-bold mb-8 tracking-tight">Privacy Policy</h1>
        <div className="prose prose-invert prose-vayu max-w-none">
          <p className="text-vayu-muted mb-8">Last updated: {new Date().toLocaleDateString()}</p>
          
          <p className="mb-6 leading-relaxed text-vayu-fg">
            Your privacy is important to us. It is VAYU AI's policy to respect your privacy regarding any information we may collect from you across our website.
          </p>
          
          <h2 className="text-2xl font-semibold mt-10 mb-4 text-white">1. Information We Collect</h2>
          <p className="mb-6 leading-relaxed text-vayu-fg">
            We only ask for personal information when we truly need it to provide a service to you. We collect it by fair and lawful means, with your knowledge and consent. We also let you know why we're collecting it and how it will be used.
          </p>
          
          <h2 className="text-2xl font-semibold mt-10 mb-4 text-white">2. How We Use Information</h2>
          <p className="mb-6 leading-relaxed text-vayu-fg">
            We use the information we collect to provide, maintain, and improve our services, as well as to communicate with you and personalize your experience.
          </p>
          
          <h2 className="text-2xl font-semibold mt-10 mb-4 text-white">3. Data Security</h2>
          <p className="mb-6 leading-relaxed text-vayu-fg">
            We protect the personal information we store within commercially acceptable means to prevent loss and theft, as well as unauthorized access, disclosure, copying, use or modification.
          </p>
        </div>
      </div>
    </main>
  );
}
