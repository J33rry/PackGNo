// Type declarations for CSS imports used by the Expo template's web target.
// (The web build isn't shipped — apps/web/Next.js is our web app — but these
// keep `tsc --noEmit` happy for the native codebase.)

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.css';
