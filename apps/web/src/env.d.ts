interface ImportMetaEnv {
  readonly PUBLIC_API_URL?: string;
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
  readonly PUBLIC_UMAMI_WEBSITE_ID?: string;
  readonly PUBLIC_CONTROLLER_NAME?: string;
  readonly PUBLIC_CONTROLLER_EMAIL?: string;
  readonly PUBLIC_CONTROLLER_ADDRESS?: string;
  /** Build time only: the seen calls registry listed by the open calls page. */
  readonly SEEN_FILE?: string;
}
