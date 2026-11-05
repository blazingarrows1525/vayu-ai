export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main id="main" tabIndex={-1} className="min-h-screen bg-[#050505]">
      {children}
    </main>
  );
}
