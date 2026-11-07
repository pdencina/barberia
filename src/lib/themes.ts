// Catálogo compartido por preferencias, API y aplicación del tema.
export const THEMES = [
  { value: "light", label: "Claro", background: "#f5f7fa", ink: "#0b7375" },
  { value: "dark", label: "Oscuro", background: "#151921", ink: "#36c5c8" },
  { value: "rose", label: "Rosa", background: "#ffffff", ink: "#b12f68" },
  { value: "monochrome", label: "Blanco y negro", background: "#ffffff", ink: "#202020" },
  { value: "monochrome-dark", label: "Negro con blanco", background: "#111111", ink: "#ffffff" },
] as const;
export type AppTheme = typeof THEMES[number]["value"];
export const isAppTheme = (value: unknown): value is AppTheme => THEMES.some(t => t.value === value);
export const normalizeTheme = (value: unknown): AppTheme => isAppTheme(value) ? value : "light";
export const isDarkTheme = (value: unknown) => value === "dark" || value === "monochrome-dark";

export function applyColorTheme(root: HTMLElement, theme: AppTheme) {
  root.classList.toggle("dark", isDarkTheme(theme));
  root.dataset.colorTheme = theme;
}
export function clearColorTheme(root: HTMLElement) {
  root.classList.remove("dark");
  delete root.dataset.colorTheme;
}
