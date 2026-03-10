import { useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import IconButton from "@mui/material/IconButton";
import Collapse from "@mui/material/Collapse";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfoIcon from "@mui/icons-material/Info";
import WarningIcon from "@mui/icons-material/Warning";
import ErrorIcon from "@mui/icons-material/Error";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import FlagIcon from "@mui/icons-material/Flag";
import type { ProgressUpdateMessage } from "../../shared/types";

const categoryConfig: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
  info: {
    icon: <InfoIcon fontSize="small" color="info" />,
    color: "info.main",
    bgColor: "info.50",
  },
  warning: {
    icon: <WarningIcon fontSize="small" color="warning" />,
    color: "warning.main",
    bgColor: "warning.50",
  },
  error: {
    icon: <ErrorIcon fontSize="small" color="error" />,
    color: "error.main",
    bgColor: "error.50",
  },
  success: {
    icon: <CheckCircleIcon fontSize="small" color="success" />,
    color: "success.main",
    bgColor: "success.50",
  },
  milestone: {
    icon: <FlagIcon fontSize="small" color="secondary" />,
    color: "secondary.main",
    bgColor: "secondary.50",
  },
};

interface Props {
  entry: ProgressUpdateMessage;
  verbosity: "simple" | "detailed";
}

export function ProgressEntry({ entry, verbosity }: Props) {
  const config = categoryConfig[entry.category] ?? categoryConfig.info;
  const [expanded, setExpanded] = useState(entry.category === "error");
  const hasDetail = entry.detail || entry.filesChanged.length > 0 || entry.toolsUsed.length > 0;

  const time = new Date(entry.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const progressPct = entry.progress ? (entry.progress.current / entry.progress.total) * 100 : 0;

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
        <Box sx={{ flexShrink: 0, mt: 0.25 }}>{config.icon}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}
          >
            <Typography variant="body2" fontWeight={600} sx={{ color: config.color }}>
              {entry.summary}
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>
              {time}
            </Typography>
          </Box>

          {/* Progress bar */}
          {entry.progress && (
            <Box sx={{ mt: 1 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {entry.progress.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {entry.progress.current} / {entry.progress.total}
                </Typography>
              </Box>
              <LinearProgress variant="determinate" value={progressPct} sx={{ borderRadius: 1 }} />
            </Box>
          )}

          {/* Expandable detail section */}
          {hasDetail && verbosity === "detailed" && (
            <>
              <IconButton
                size="small"
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
                aria-label="Toggle details"
                sx={{ mt: 0.5, p: 0.25 }}
              >
                <ExpandMoreIcon
                  fontSize="small"
                  sx={{
                    transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                  }}
                />
              </IconButton>
              <Collapse in={expanded}>
                <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
                  {entry.detail && (
                    <Typography variant="caption" color="text.secondary">
                      {entry.detail}
                    </Typography>
                  )}
                  {entry.filesChanged.length > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      <strong>Files:</strong> {entry.filesChanged.join(", ")}
                    </Typography>
                  )}
                  {entry.toolsUsed.length > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      <strong>Tools:</strong> {entry.toolsUsed.join(", ")}
                    </Typography>
                  )}
                </Box>
              </Collapse>
            </>
          )}
        </Box>
      </Box>
    </Paper>
  );
}
