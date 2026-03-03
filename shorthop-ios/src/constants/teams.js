// All 30 MLB teams with their 3-letter Statcast code, full name, and exact
// primary/secondary colors.
// Codes match the hfTeam parameter used by Baseball Savant.
export const TEAMS = [
  { code: "ARI", name: "Arizona Diamondbacks", color: "#A71930", primary: "#A71930", secondary: "#000000" },
  { code: "ATL", name: "Atlanta Braves", color: "#CE1141", primary: "#CE1141", secondary: "#13274F" },
  { code: "BAL", name: "Baltimore Orioles", color: "#DF4601", primary: "#DF4601", secondary: "#000000" },
  { code: "BOS", name: "Boston Red Sox", color: "#BD3039", primary: "#BD3039", secondary: "#0C2340" },
  { code: "CHC", name: "Chicago Cubs", color: "#0E3386", primary: "#0E3386", secondary: "#CC3433" },
  { code: "CWS", name: "Chicago White Sox", color: "#27251F", primary: "#27251F", secondary: "#C4CED4" },
  { code: "CIN", name: "Cincinnati Reds", color: "#C6011F", primary: "#C6011F", secondary: "#000000" },
  { code: "CLE", name: "Cleveland Guardians", color: "#00385D", primary: "#00385D", secondary: "#E50022" },
  { code: "COL", name: "Colorado Rockies", color: "#000000", primary: "#000000", secondary: "#333366" },
  { code: "DET", name: "Detroit Tigers", color: "#0C2340", primary: "#0C2340", secondary: "#FA4616" },
  { code: "HOU", name: "Houston Astros", color: "#002D62", primary: "#002D62", secondary: "#EB6E1F" },
  { code: "KC", name: "Kansas City Royals", color: "#004687", primary: "#004687", secondary: "#FFFFFF" },
  { code: "LAA", name: "Los Angeles Angels", color: "#BA0021", primary: "#BA0021", secondary: "#85714D" },
  { code: "LAD", name: "Los Angeles Dodgers", color: "#005A9C", primary: "#005A9C", secondary: "#FFFFFF" },
  { code: "MIA", name: "Miami Marlins", color: "#000000", primary: "#000000", secondary: "#00A3E0" },
  { code: "MIL", name: "Milwaukee Brewers", color: "#FFC52F", primary: "#FFC52F", secondary: "#12284B" },
  { code: "MIN", name: "Minnesota Twins", color: "#002B5C", primary: "#002B5C", secondary: "#D31145" },
  { code: "NYM", name: "New York Mets", color: "#002D72", primary: "#002D72", secondary: "#FF5910" },
  { code: "NYY", name: "New York Yankees", color: "#003087", primary: "#003087", secondary: "#C4CED3" },
  { code: "OAK", name: "Oakland Athletics", color: "#003831", primary: "#003831", secondary: "#EFB21E" },
  { code: "PHI", name: "Philadelphia Phillies", color: "#E81828", primary: "#E81828", secondary: "#FFFFFF" },
  { code: "PIT", name: "Pittsburgh Pirates", color: "#27251F", primary: "#27251F", secondary: "#FDB827" },
  { code: "SD", name: "San Diego Padres", color: "#2F241D", primary: "#2F241D", secondary: "#FFC425" },
  { code: "SF", name: "San Francisco Giants", color: "#FD5A1E", primary: "#FD5A1E", secondary: "#27251F" },
  { code: "SEA", name: "Seattle Mariners", color: "#0C2C56", primary: "#0C2C56", secondary: "#005C5C" },
  { code: "STL", name: "St. Louis Cardinals", color: "#C41E3A", primary: "#C41E3A", secondary: "#FFFFFF" },
  { code: "TB", name: "Tampa Bay Rays", color: "#092C5C", primary: "#092C5C", secondary: "#8FBCE6" },
  { code: "TEX", name: "Texas Rangers", color: "#003278", primary: "#003278", secondary: "#C0111F" },
  { code: "TOR", name: "Toronto Blue Jays", color: "#134A8E", primary: "#134A8E", secondary: "#FFFFFF" },
  { code: "WSH", name: "Washington Nationals", color: "#AB0003", primary: "#AB0003", secondary: "#14225A" },
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
