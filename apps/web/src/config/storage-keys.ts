/**
 * Keys of the values kept in the browser. The inline scripts that run before the first paint
 * receive them through define:vars.
 */
export const STORAGE_KEYS = {
  /** localStorage: "light" or "dark", picked with the theme toggle. */
  theme: "postthedoc-theme",
  /** localStorage: the language picked with the switcher, for the root page redirect. */
  locale: "postthedoc-locale",
  /** sessionStorage: the email typed on the home page, read by the subscribe wizard. */
  email: "postthedoc-email",
  /** sessionStorage: the manage token, moved there from the email link. */
  manageToken: "postthedoc-manage-token",
} as const;
