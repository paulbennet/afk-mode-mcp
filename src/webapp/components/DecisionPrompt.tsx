import { useState, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import { useWebSocket } from "../hooks/useWebSocket";
import { DiffViewer } from "./DiffViewer";

export function DecisionPrompt() {
  const { pendingDecision, respondToDecision } = useWebSocket();
  const [textValue, setTextValue] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (!pendingDecision) return;
    setTextValue("");
    setTimeLeft(pendingDecision.timeoutSeconds);

    // Vibrate
    if ("vibrate" in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [pendingDecision]);

  if (!pendingDecision) return null;

  const { id, prompt, decisionType, options, diff, timeoutSeconds } = pendingDecision;
  const progressPct = (timeLeft / timeoutSeconds) * 100;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog
      open
      fullWidth
      maxWidth="sm"
      slotProps={{
        backdrop: { sx: { backdropFilter: "blur(4px)" } },
      }}
    >
      <LinearProgress
        variant="determinate"
        value={progressPct}
        color={timeLeft < 30 ? "error" : "primary"}
        sx={{ height: 4 }}
      />
      <DialogContent sx={{ p: 3 }}>
        {/* Timer */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Typography variant="overline" color="text.secondary">
            Decision Needed
          </Typography>
          <Typography
            variant="body2"
            fontFamily="monospace"
            color={timeLeft < 30 ? "error.main" : "text.secondary"}
          >
            {formatTime(timeLeft)}
          </Typography>
        </Box>

        {/* Prompt */}
        <Typography variant="body1" fontWeight={500} sx={{ mb: 3 }}>
          {prompt}
        </Typography>

        {/* Decision UI based on type */}
        {decisionType === "confirm" && (
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <Button
              fullWidth
              variant="contained"
              onClick={() => respondToDecision(id, "yes")}
              size="large"
            >
              Yes
            </Button>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => respondToDecision(id, "no")}
              size="large"
            >
              No
            </Button>
          </Box>
        )}

        {decisionType === "choice" && options && (
          <List disablePadding>
            {options.map((opt) => (
              <ListItemButton
                key={opt}
                onClick={() => respondToDecision(id, opt)}
                sx={{ borderRadius: 1.5, border: 1, borderColor: "divider", mb: 1, py: 1.5 }}
              >
                <ListItemText primary={opt} primaryTypographyProps={{ fontWeight: 500 }} />
              </ListItemButton>
            ))}
          </List>
        )}

        {decisionType === "text" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <TextField
              multiline
              minRows={3}
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder="Type your response..."
              autoFocus
              fullWidth
            />
            <Button
              variant="contained"
              onClick={() => respondToDecision(id, textValue)}
              disabled={!textValue.trim()}
              size="large"
              fullWidth
            >
              Submit
            </Button>
          </Box>
        )}

        {decisionType === "diff" && diff && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <DiffViewer diff={diff} />
            <Box sx={{ display: "flex", gap: 1.5 }}>
              <Button
                fullWidth
                variant="contained"
                color="success"
                onClick={() => respondToDecision(id, "approved")}
                size="large"
              >
                Approve
              </Button>
              <Button
                fullWidth
                variant="contained"
                color="error"
                onClick={() => respondToDecision(id, "rejected")}
                size="large"
              >
                Reject
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
