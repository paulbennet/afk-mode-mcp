import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import type { DiffInfo } from "../../shared/types";

interface Props {
  diff: DiffInfo;
}

export function DiffViewer({ diff }: Props) {
  const beforeLines = diff.before.split("\n");
  const afterLines = diff.after.split("\n");

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Box
        sx={{
          px: 1.5,
          py: 0.75,
          bgcolor: "action.hover",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Typography variant="caption" fontFamily="monospace" color="text.secondary" noWrap>
          {diff.filePath}
        </Typography>
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Box
          component="pre"
          sx={{ m: 0, fontSize: "0.75rem", lineHeight: 1.8, fontFamily: "monospace" }}
        >
          {beforeLines.map((line, i) => (
            <Box
              key={`before-${i}`}
              sx={{
                px: 1.5,
                bgcolor: "error.main",
                backgroundColor: (theme) =>
                  theme.palette.mode === "dark" ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.06)",
                color: "error.main",
              }}
            >
              <Typography
                component="span"
                sx={{
                  userSelect: "none",
                  mr: 1,
                  color: "error.dark",
                  fontFamily: "monospace",
                  fontSize: "inherit",
                }}
              >
                -
              </Typography>
              {line}
            </Box>
          ))}
          {afterLines.map((line, i) => (
            <Box
              key={`after-${i}`}
              sx={{
                px: 1.5,
                bgcolor: "success.main",
                backgroundColor: (theme) =>
                  theme.palette.mode === "dark" ? "rgba(34,197,94,0.1)" : "rgba(34,197,94,0.06)",
                color: "success.main",
              }}
            >
              <Typography
                component="span"
                sx={{
                  userSelect: "none",
                  mr: 1,
                  color: "success.dark",
                  fontFamily: "monospace",
                  fontSize: "inherit",
                }}
              >
                +
              </Typography>
              {line}
            </Box>
          ))}
        </Box>
      </Box>
    </Paper>
  );
}
