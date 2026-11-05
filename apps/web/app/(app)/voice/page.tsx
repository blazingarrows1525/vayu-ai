import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { VoiceAssistant } from "@/components/voice/voice-assistant";

export const metadata: Metadata = { title: "Voice" };

export default function VoicePage() {
  return (
    <PageContainer size="narrow">
      <PageHeader
        eyebrow="Voice & media"
        title="Voice"
        description="Ask a question out loud and get a short answer. For a back-and-forth conversation, use Live."
      />
      <VoiceAssistant />
    </PageContainer>
  );
}
