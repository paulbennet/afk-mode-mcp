import { createTheme } from "@mui/material/styles";

export function buildTheme(mode: "light" | "dark") {
    return createTheme({
        palette: {
            mode,
            primary: { main: "#3b82f6" },
            secondary: { main: "#8b5cf6" },
            success: { main: "#22c55e" },
            warning: { main: "#eab308" },
            error: { main: "#ef4444" },
            background: {
                default: mode === "dark" ? "#0f172a" : "#f8fafc",
                paper: mode === "dark" ? "#1e293b" : "#ffffff",
            },
        },
        shape: { borderRadius: 12 },
        typography: {
            fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        },
        components: {
            MuiButton: {
                styleOverrides: {
                    root: { textTransform: "none", fontWeight: 600 },
                },
            },
            MuiBottomNavigationAction: {
                styleOverrides: {
                    root: { minWidth: 0 },
                },
            },
        },
    });
}
