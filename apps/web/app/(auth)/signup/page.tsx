import { redirect } from "next/navigation";

export default function SignupPage() {
  // Authentication is now strictly OAuth, so login and signup are the same flow.
  redirect("/login");
}
