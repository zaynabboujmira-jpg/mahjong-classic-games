/// <reference types="astro/client" />

/** Optional build-time settings (Cloudflare Pages environment variables). All unset by default. */
interface ImportMetaEnv {
  readonly SITE_URL?: string;
  /** Google Search Console HTML-tag verification token. */
  readonly PUBLIC_GSC_VERIFICATION?: string;
  /** Bing Webmaster Tools verification token (msvalidate.01). */
  readonly PUBLIC_BING_VERIFICATION?: string;
  /** Google Analytics 4 measurement id, e.g. G-XXXXXXX. Loaded only after consent. */
  readonly PUBLIC_GA4_ID?: string;
  /** AdSense publisher id, e.g. ca-pub-1234567890123456. Ad slots exist only when set. */
  readonly PUBLIC_ADSENSE_CLIENT?: string;
  /** Optional AdSense ad unit id for the in-page slots (numbers only). */
  readonly PUBLIC_ADSENSE_SLOT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
