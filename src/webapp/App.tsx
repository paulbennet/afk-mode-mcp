import { useState, useEffect, useMemo } from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import DashboardIcon from "@mui/icons-material/Dashboard";
import HistoryIcon from "@mui/icons-material/History";
import SettingsIcon from "@mui/icons-material/Settings";
import PowerOffIcon from "@mui/icons-material/PowerOff";
import { WebSocketProvider, useWebSocket } from "./hooks/useWebSocket";
import { useNotifications } from "./hooks/useNotifications";
import { StatusBar } from "./components/StatusBar";
import { Dashboard } from "./components/Dashboard";
import { SessionHistory } from "./components/SessionHistory";
import { Settings } from "./components/Settings";
import { DecisionPrompt } from "./components/DecisionPrompt";
import { buildTheme } from "./theme";
import { DEFAULT_SETTINGS, type AppSettings } from "../shared/types";

type Tab = "dashboard" | "history" | "settings";

function AppInner() {
  const { connectionState } = useWebSocket();
  useNotifications();

  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem("afk_settings");
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Persist settings
  useEffect(() => {
    localStorage.setItem("afk_settings", JSON.stringify(settings));
  }, [settings]);

  // Resolve effective color mode
  const colorMode = useMemo(() => {
    if (settings.theme === "dark") return "dark";
    if (settings.theme === "light") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }, [settings.theme]);

  const theme = useMemo(() => buildTheme(colorMode), [colorMode]);

  // Connection screen
  if (connectionState === "connecting") {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            gap: 2,
          }}
        >
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">
            Connecting to AFK Mode server…
          </Typography>
        </Box>
      </ThemeProvider>
    );
  }

  if (connectionState === "disconnected") {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            gap: 2,
            px: 3,
          }}
        >
          <PowerOffIcon sx={{ fontSize: 64, color: "text.secondary" }} />
          <Typography variant="h6">Disconnected</Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Unable to connect to the AFK Mode server. Make sure VS Code is running and you&apos;re
            on the same network.
          </Typography>
          <Button variant="contained" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        <StatusBar />

        <Box component="main" sx={{ flex: 1, overflow: "hidden" }}>
          {activeTab === "dashboard" && <Dashboard settings={settings} />}
          {activeTab === "history" && <SessionHistory settings={settings} />}
          {activeTab === "settings" && <Settings settings={settings} onUpdate={setSettings} />}
        </Box>

        <BottomNavigation
          value={activeTab}
          onChange={(_, newValue: Tab) => setActiveTab(newValue)}
          showLabels
          sx={{ borderTop: 1, borderColor: "divider" }}
        >
          <BottomNavigationAction value="dashboard" label="Dashboard" icon={<DashboardIcon />} />
          <BottomNavigationAction value="history" label="History" icon={<HistoryIcon />} />
          <BottomNavigationAction value="settings" label="Settings" icon={<SettingsIcon />} />
        </BottomNavigation>

        <DecisionPrompt />
      </Box>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <WebSocketProvider>
      <AppInner />
    </WebSocketProvider>
  );
}
