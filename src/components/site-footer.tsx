import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { brand } from "@/lib/brand";

export async function SiteFooter() {
  const t = await getTranslations("Footer");

  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:px-8 md:grid-cols-[auto_1fr] md:items-center md:gap-16">
        {/* Logo is black-on-white: invert + screen blend drops the white box on the dark footer. */}
        <Image
          src={brand.logo}
          alt={brand.name}
          width={180}
          height={180}
          className="size-36 invert mix-blend-screen md:size-44"
        />
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="display text-2xl">{t("contact")}</p>
            <ul className="mt-3 space-y-1 text-base">
              <li>
                <a href={brand.phoneHref} className="underline-offset-4 hover:underline">
                  {brand.phoneDisplay}
                </a>
              </li>
              <li>
                <a href={`mailto:${brand.email}`} className="underline-offset-4 hover:underline">
                  {brand.email}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="display text-2xl">{t("follow")}</p>
            <ul className="mt-3 space-y-1 text-base">
              <li>
                <a
                  href={brand.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-4 hover:underline"
                >
                  Instagram · @{brand.instagramHandle}
                </a>
              </li>
              <li>Facebook · {brand.facebookLabel}</li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
