import { useState, useMemo } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import HistoryIcon from "@mui/icons-material/History";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import type { ProgressUpdateMessage, AppSettings } from "../../shared/types";
import { ProgressEntry } from "./ProgressEntry";

interface Props {
  settings: AppSettings;
}

const categories = ["all", "info", "warning", "error", "success", "milestone"] as const;

export function SessionHistory({ settings }: Props) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const history: ProgressUpdateMessage[] = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("afk_progress_history") || "[]");
    } catch {
      return [];
    }
  }, []);

  const filtered = useMemo(() => {
    return history.filter((entry) => {
      const matchesSearch =
        !search ||
        entry.summary.toLowerCase().includes(search.toLowerCase()) ||
        (entry.detail ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "all" || entry.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [history, search, categoryFilter]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Filters */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search history..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ mb: 1 }}
        />
        <Box sx={{ display: "flex", gap: 0.75, overflowX: "auto", pb: 0.5 }}>
          {categories.map((cat) => (
            <Chip
              key={cat}
              label={cat.charAt(0).toUpperCase() + cat.slice(1)}
              size="small"
              color={categoryFilter === cat ? "primary" : "default"}
              variant={categoryFilter === cat ? "filled" : "outlined"}
              onClick={() => setCategoryFilter(cat)}
            />
          ))}
        </Box>
      </Box>

      {/* History list */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 1.5 }}>
        {filtered.length === 0 ? (
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
            <HistoryIcon sx={{ fontSize: 48, mb: 1.5 }} />
            <Typography variant="body2">No history entries</Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {filtered.map((entry) => (
              <ProgressEntry key={entry.id} entry={entry} verbosity={settings.verbosity} />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
