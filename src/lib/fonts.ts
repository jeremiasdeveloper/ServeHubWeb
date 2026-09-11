// ServeHub — bundled font catalog (frontend mirror of src/lib/config.ts).
// Kept separate so client bundles never import server/db code.

export const SUPPORTED_FONTS = [
  { id: "inter", label: "Inter", stack: "'Inter', system-ui, sans-serif" },
  { id: "manrope", label: "Manrope", stack: "'Manrope', system-ui, sans-serif" },
  { id: "poppins", label: "Poppins", stack: "'Poppins', system-ui, sans-serif" },
  { id: "jakarta", label: "Plus Jakarta Sans", stack: "'Plus Jakarta Sans', system-ui, sans-serif" },
  { id: "nunito", label: "Nunito Sans", stack: "'Nunito Sans', system-ui, sans-serif" },
  { id: "dmsans", label: "DM Sans", stack: "'DM Sans', system-ui, sans-serif" },
] as const

export function fontStackFor(id: string): string {
  return SUPPORTED_FONTS.find((f) => f.id === id)?.stack ?? SUPPORTED_FONTS[0].stack
}
