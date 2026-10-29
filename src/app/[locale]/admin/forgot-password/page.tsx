import { getTranslations, setRequestLocale } from "next-intl/server";
import { ForgotPasswordForm } from "@/components/admin/forgot-password-form";

export default async function AdminForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("AdminForgotPassword");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <h1 className="mb-6 text-center text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <ForgotPasswordForm />
    </main>
  );
}
