import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { useWebSocket } from "../hooks/useWebSocket";

export function StatusBar() {
  const { connectionState, afkMode, sessionId } = useWebSocket();

  const isConnected = connectionState === "connected";

  const statusColor = isConnected
    ? "success"
    : connectionState === "connecting"
      ? "warning"
      : "error";
  const statusLabel = isConnected
    ? "Connected"
    : connectionState === "connecting"
      ? "Connecting…"
      : "Disconnected";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 2,
        py: 1,
        bgcolor: "background.paper",
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <FiberManualRecordIcon
          color={statusColor}
          sx={{
            fontSize: 12,
            ...(connectionState === "connecting" && {
              animation: "pulse 1.5s ease-in-out infinite",
              "@keyframes pulse": {
                "0%, 100%": { opacity: 1 },
                "50%": { opacity: 0.4 },
              },
            }),
          }}
        />
        <Typography variant="body2" color="text.secondary">
          {statusLabel}
        </Typography>
      </Box>

      {afkMode && (
        <Chip
          label="AFK"
          size="small"
          color="primary"
          sx={{
            fontWeight: 600,
            animation: "pulse-afk 2s ease-in-out infinite",
            "@keyframes pulse-afk": {
              "0%, 100%": { opacity: 1 },
              "50%": { opacity: 0.5 },
            },
          }}
        />
      )}

      {sessionId && (
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{
            ml: "auto",
            fontFamily: "monospace",
            maxWidth: 120,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {sessionId.slice(0, 8)}
        </Typography>
      )}
    </Box>
  );
}
