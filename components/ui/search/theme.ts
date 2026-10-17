// Tailwind's neutral palette as hex, for places that can't take a className (SVG props, placeholders)
export const colors = {
    n100: "#f5f5f5",
    n200: "#e5e5e5",
    n300: "#d4d4d4",
    n400: "#a3a3a3",
    n500: "#737373",
    n600: "#525252",
};

export const white = (alpha: number) => `rgba(255,255,255,${alpha})`;

// "Raised" surface used by avatars, icon buttons and the submit button
export const RAISED = "bg-[#0c0c0c] border border-white/10";