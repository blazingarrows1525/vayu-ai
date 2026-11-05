import type { Metadata } from "next";
import { LEGAL_UPDATED, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated={LEGAL_UPDATED}>
      <p>
        Your privacy is important to us. It is VAYU AI&rsquo;s policy to respect your privacy regarding any information we may
        collect from you across our website.
      </p>
      <h2>1. Information We Collect</h2>
      <p>
        We only ask for personal information when we truly need it to provide a service to you. We collect it by fair and lawful
        means, with your knowledge and consent. We also let you know why we&rsquo;re collecting it and how it will be used.
      </p>
      <h2>2. How We Use Information</h2>
      <p>
        We use the information we collect to provide, maintain, and improve our services, as well as to communicate with you and
        personalize your experience.
      </p>
      <h2>3. Data Security</h2>
      <p>
        We protect the personal information we store within commercially acceptable means to prevent loss and theft, as well as
        unauthorized access, disclosure, copying, use or modification.
      </p>
    </LegalPage>
  );
}
