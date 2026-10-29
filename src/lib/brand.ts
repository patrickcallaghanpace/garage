/**
 * Per-customer public identity (contact details, social handles, logo asset).
 * When onboarding another garagiste, this file and public/brand/* are what
 * change — see docs/NEW_CUSTOMER.md.
 */
export const brand = {
  name: "Pneu@Home",
  phoneDisplay: "077 269 22 25",
  phoneHref: "tel:+41772692225",
  email: "info@pneuathome.ch",
  instagramHandle: "Pneu_at_Home",
  instagramUrl: "https://www.instagram.com/pneu_at_home/",
  facebookLabel: "Pneu at Home",
  logo: "/brand/logo.png",
  trailerPhoto: "/brand/trailer.webp",
} as const;
