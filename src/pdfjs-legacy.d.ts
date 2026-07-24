// The pdfjs-dist "legacy" build (transpiled for older Safari/browsers) has the
// same public API as the modern build but ships no separate .d.ts for the
// subpath. Re-export the main package's types so it is fully typed.
declare module 'pdfjs-dist/legacy/build/pdf' {
  export * from 'pdfjs-dist';
}
