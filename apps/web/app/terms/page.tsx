import type { Metadata } from "next";
import { LEGAL_UPDATED, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated={LEGAL_UPDATED}>
      <p>Welcome to VAYU AI. By accessing our platform, you agree to these terms.</p>
      <h2>1. Acceptance of Terms</h2>
      <p>By using our services, you agree to be bound by these Terms of Service and all applicable laws and regulations.</p>
      <h2>2. Use License</h2>
      <p>
        Permission is granted to temporarily use the materials on VAYU AI&rsquo;s website for personal, non-commercial transitory
        viewing only.
      </p>
      <h2>3. Disclaimer</h2>
      <p>
        The materials on VAYU AI&rsquo;s website are provided on an &lsquo;as is&rsquo; basis. VAYU AI makes no warranties,
        expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied
        warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property
        or other violation of rights.
      </p>
    </LegalPage>
  );
}
