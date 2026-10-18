import { redirect } from "next/navigation";

export default function SignupPage() {
  // One auth page; it opens in create-account mode for email sign-ups.
  redirect("/login?mode=signup");
}
