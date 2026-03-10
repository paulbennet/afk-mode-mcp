import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Switch from "@mui/material/Switch";
import Slider from "@mui/material/Slider";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import DeleteIcon from "@mui/icons-material/Delete";
import type { AppSettings } from "../../shared/types";

interface Props {
  settings: AppSettings;
  onUpdate: (settings: AppSettings) => void;
}

export function Settings({ settings, onUpdate }: Props) {
  const update = (partial: Partial<AppSettings>) => {
    onUpdate({ ...settings, ...partial });
  };

  return (
    <Box sx={{ px: 2, py: 3, display: "flex", flexDirection: "column", gap: 3 }}>
      <Typography variant="h6">Settings</Typography>

      {/* Verbosity */}
      <Box>
        <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
          Verbosity
        </Typography>
        <ToggleButtonGroup
          value={settings.verbosity}
          exclusive
          onChange={(_, value: "simple" | "detailed" | null) => {
            if (value) update({ verbosity: value });
          }}
          fullWidth
          size="small"
        >
          <ToggleButton value="simple">Simple</ToggleButton>
          <ToggleButton value="detailed">Detailed</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Sound */}
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="body2" fontWeight={500}>
            Sound
          </Typography>
          <Switch
            checked={settings.soundEnabled}
            onChange={(_, checked) => update({ soundEnabled: checked })}
            inputProps={{ "aria-label": "Toggle sound" }}
          />
        </Box>
        {settings.soundEnabled && (
          <Slider
            value={settings.soundVolume}
            onChange={(_, value) => update({ soundVolume: value as number })}
            min={0}
            max={1}
            step={0.1}
            aria-label="Volume"
            size="small"
          />
        )}
      </Box>

      {/* Vibration */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="body2" fontWeight={500}>
          Vibration
        </Typography>
        <Switch
          checked={settings.vibrationEnabled}
          onChange={(_, checked) => update({ vibrationEnabled: checked })}
          inputProps={{ "aria-label": "Toggle vibration" }}
        />
      </Box>

      {/* Theme */}
      <Box>
        <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
          Theme
        </Typography>
        <ToggleButtonGroup
          value={settings.theme}
          exclusive
          onChange={(_, value: "light" | "dark" | "system" | null) => {
            if (value) update({ theme: value });
          }}
          fullWidth
          size="small"
        >
          <ToggleButton value="light">Light</ToggleButton>
          <ToggleButton value="dark">Dark</ToggleButton>
          <ToggleButton value="system">System</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Clear history */}
      <Divider />
      <Button
        variant="outlined"
        color="error"
        startIcon={<DeleteIcon />}
        onClick={() => {
          localStorage.removeItem("afk_progress_history");
          window.location.reload();
        }}
        fullWidth
      >
        Clear Session History
      </Button>
    </Box>
  );
}
