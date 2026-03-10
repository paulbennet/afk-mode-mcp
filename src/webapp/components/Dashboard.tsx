import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Switch from "@mui/material/Switch";
import Divider from "@mui/material/Divider";
import AssignmentIcon from "@mui/icons-material/Assignment";
import { useWebSocket } from "../hooks/useWebSocket";
import { ProgressEntry } from "./ProgressEntry";
import type { AppSettings } from "../../shared/types";

interface Props {
  settings: AppSettings;
}

export function Dashboard({ settings }: Props) {
  const { afkMode, setAfkMode, progressUpdates, connectionState } = useWebSocket();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* AFK Toggle */}
      <Box sx={{ px: 2, py: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box>
            <Typography variant="h6">AFK Mode</Typography>
            <Typography variant="body2" color="text.secondary">
              {afkMode ? "Copilot will route interactions here" : "Copilot uses VS Code chat"}
            </Typography>
          </Box>
          <Switch
            checked={afkMode}
            onChange={(_, checked) => setAfkMode(checked)}
            disabled={connectionState !== "connected"}
            inputProps={{ "aria-label": "Toggle AFK mode" }}
          />
        </Box>
      </Box>

      <Divider />

      {/* Progress Feed */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 1.5 }}>
        {progressUpdates.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "text.disabled",
            }}
          >
            <AssignmentIcon sx={{ fontSize: 48, mb: 1.5 }} />
            <Typography variant="body2">No progress updates yet</Typography>
            <Typography variant="caption" sx={{ mt: 0.5 }}>
              {afkMode
                ? "Updates will appear here as Copilot works"
                : "Enable AFK mode to start receiving updates"}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {progressUpdates.map((entry) => (
              <ProgressEntry key={entry.id} entry={entry} verbosity={settings.verbosity} />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
