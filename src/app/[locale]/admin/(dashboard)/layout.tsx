import { AdminNav } from "@/components/admin/admin-nav";

// Every page here reads the live DB (and is auth-gated by src/proxy.ts), so
// none of it should ever be statically prerendered/cached at build time.
export const dynamic = "force-dynamic";

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col pb-16">
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">{children}</div>
      <AdminNav />
    </div>
  );
}
