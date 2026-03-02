// All 30 MLB teams with their 3-letter Statcast code, full name, and primary color.
// Codes match the hfTeam parameter used by Baseball Savant.
export const TEAMS = [
  { code: "ARI", name: "Arizona Diamondbacks",      color: "#A71930" },
  { code: "ATL", name: "Atlanta Braves",             color: "#CE1141" },
  { code: "BAL", name: "Baltimore Orioles",          color: "#DF4601" },
  { code: "BOS", name: "Boston Red Sox",             color: "#BD3039" },
  { code: "CHC", name: "Chicago Cubs",               color: "#0E3386" },
  { code: "CWS", name: "Chicago White Sox",          color: "#27251F" },
  { code: "CIN", name: "Cincinnati Reds",            color: "#C6011F" },
  { code: "CLE", name: "Cleveland Guardians",        color: "#00385D" },
  { code: "COL", name: "Colorado Rockies",           color: "#33006F" },
  { code: "DET", name: "Detroit Tigers",             color: "#0C2340" },
  { code: "HOU", name: "Houston Astros",             color: "#002D62" },
  { code: "KC",  name: "Kansas City Royals",         color: "#004687" },
  { code: "LAA", name: "Los Angeles Angels",         color: "#BA0021" },
  { code: "LAD", name: "Los Angeles Dodgers",        color: "#005A9C" },
  { code: "MIA", name: "Miami Marlins",              color: "#00A3E0" },
  { code: "MIL", name: "Milwaukee Brewers",          color: "#12284B" },
  { code: "MIN", name: "Minnesota Twins",            color: "#002B5C" },
  { code: "NYM", name: "New York Mets",              color: "#002D72" },
  { code: "NYY", name: "New York Yankees",           color: "#003087" },
  { code: "OAK", name: "Oakland Athletics",          color: "#003831" },
  { code: "PHI", name: "Philadelphia Phillies",      color: "#E81828" },
  { code: "PIT", name: "Pittsburgh Pirates",         color: "#27251F" },
  { code: "SD",  name: "San Diego Padres",           color: "#2F241D" },
  { code: "SF",  name: "San Francisco Giants",       color: "#FD5A1E" },
  { code: "SEA", name: "Seattle Mariners",           color: "#0C2C56" },
  { code: "STL", name: "St. Louis Cardinals",        color: "#C41E3A" },
  { code: "TB",  name: "Tampa Bay Rays",             color: "#092C5C" },
  { code: "TEX", name: "Texas Rangers",              color: "#003278" },
  { code: "TOR", name: "Toronto Blue Jays",          color: "#134A8E" },
  { code: "WSH", name: "Washington Nationals",       color: "#AB0003" },
];

export function teamByCode(code) {
  return TEAMS.find((t) => t.code === code) || null;
}

export function teamName(code) {
  const t = teamByCode(code);
  return t ? t.name : code;
}

// Human-readable event labels
export const EVENT_LABELS = {
  home_run:           "Home Run",
  triple:             "Triple",
  double:             "Double",
  single:             "Single",
  walk:               "Walk",
  strikeout:          "Strikeout",
  strikeout_double_play: "Strikeout DP",
  field_out:          "Field Out",
  force_out:          "Force Out",
  grounded_into_double_play: "GIDP",
  double_play:        "Double Play",
  field_error:        "Error",
  sac_fly:            "Sac Fly",
  sac_bunt:           "Sac Bunt",
  hit_by_pitch:       "HBP",
  intent_walk:        "IBB",
  caught_stealing_2b: "CS 2B",
  caught_stealing_3b: "CS 3B",
  caught_stealing_home: "CS Home",
  stolen_base_2b:     "SB 2B",
  stolen_base_3b:     "SB 3B",
  stolen_base_home:   "SB Home",
  wild_pitch:         "Wild Pitch",
  passed_ball:        "Passed Ball",
  pickoff_1b:         "Pickoff 1B",
  pickoff_2b:         "Pickoff 2B",
  pickoff_caught_stealing_2b: "PO CS 2B",
  pickoff_caught_stealing_home: "PO CS Home",
  runner_double_play: "Runner DP",
  fielders_choice:    "Fielder's Choice",
  fielders_choice_out: "Fielder's Choice Out",
  triple_play:        "Triple Play",
  other_out:          "Out",
};

export function eventLabel(event) {
  return EVENT_LABELS[event] || event?.replace(/_/g, " ") || "";
}
