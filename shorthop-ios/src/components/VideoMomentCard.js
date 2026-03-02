/**
 * VideoMomentCard — moment card with an embedded tap-to-play video.
 *
 * Video source: fastball-clips.mlb.com CDN (direct MP4, no proxy needed).
 * Tries the home broadcast first; falls back to away on error.
 * Long-press triggers delete. Tap "View on Savant" to open in browser.
 */

import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import colors from "../constants/colors";
import { eventLabel } from "../constants/teams";

const BROADCASTS = ["home", "away"];

// MLB's CDN requires these headers or it redirects to a search page instead of the video.
const CDN_HEADERS = {
  Origin: "https://www.mlb.com",
  Referer: "https://www.mlb.com/",
};

function cdnSource(gamePk, playId, broadcast) {
  return {
    uri: `https://fastball-clips.mlb.com/${gamePk}/${broadcast}/${playId}.mp4`,
    headers: CDN_HEADERS,
  };
}

export default function VideoMomentCard({ moment, onLongPress }) {
  const [active, setActive] = useState(false);
  const [hasError, setHasError] = useState(false);
  const broadcastIdx = useRef(0);

  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
  });

  // Attach listener at mount so no status events are ever missed.
  useEffect(() => {
    const sub = player.addListener("statusChange", ({ status, error }) => {
      if (status === "error" || error) {
        // Try the next broadcast (home → away) before giving up.
        const next = broadcastIdx.current + 1;
        if (next < BROADCASTS.length) {
          broadcastIdx.current = next;
          player
            .replaceAsync(cdnSource(moment.gamePk, moment.playId, BROADCASTS[next]))
            .catch(() => setHasError(true));
        } else {
          setHasError(true);
        }
      } else if (status === "readyToPlay") {
        player.play();
      }
    });
    return () => sub.remove();
  }, [player, moment.gamePk, moment.playId]);

  function activate() {
    if (!moment.gamePk || !moment.playId) {
      setHasError(true);
      return;
    }
    broadcastIdx.current = 0;
    setHasError(false);
    setActive(true);
    player
      .replaceAsync(cdnSource(moment.gamePk, moment.playId, BROADCASTS[0]))
      .catch(() => setHasError(true));
  }

  function openInBrowser() {
    if (moment.savantUrl) {
      Linking.openURL(moment.savantUrl).catch(() =>
        Alert.alert("Could not open link")
      );
    }
  }

  const label = eventLabel(moment.event);
  const wpaNum = parseFloat(moment.wpa) || 0;
  const wpaSign = wpaNum >= 0 ? "+" : "";
  const wpaColor =
    wpaNum > 0 ? "#4CAF50" : wpaNum < 0 ? colors.accent : colors.textSecondary;

  return (
    <View style={styles.card} onStartShouldSetResponder={() => false}>
      {/* 16:9 video area */}
      <TouchableOpacity
        style={styles.videoArea}
        onPress={active ? undefined : activate}
        onLongPress={onLongPress}
        activeOpacity={active ? 1 : 0.8}
      >
        {active && !hasError ? (
          <VideoView
            player={player}
            style={styles.video}
            fullscreenOptions={{ supportedOrientations: "landscape" }}
            allowsPictureInPicture
            contentFit="contain"
          />
        ) : (
          <View style={styles.placeholder}>
            {hasError ? (
              <Ionicons
                name="alert-circle-outline"
                size={30}
                color={colors.textMuted}
              />
            ) : (
              <Ionicons
                name="play-circle-outline"
                size={54}
                color="rgba(255,255,255,0.85)"
              />
            )}
          </View>
        )}
      </TouchableOpacity>

      {/* Metadata row */}
      <View style={styles.info}>
        <View style={styles.infoTop}>
          <Text style={styles.playerName} numberOfLines={1}>
            {moment.playerName}
          </Text>
          <Text style={[styles.wpa, { color: wpaColor }]}>
            {wpaSign}{wpaNum.toFixed(2)}
          </Text>
        </View>
        <Text style={styles.eventText} numberOfLines={1}>
          {label}
          {moment.battingTeam
            ? `  ·  ${moment.battingTeam} vs ${moment.pitchingTeam}`
            : ""}
        </Text>
        {moment.description ? (
          <Text style={styles.desc} numberOfLines={2}>
            {moment.description}
          </Text>
        ) : null}
        {moment.savantUrl ? (
          <TouchableOpacity onPress={openInBrowser} style={styles.savantLink}>
            <Ionicons name="open-outline" size={12} color={colors.textMuted} style={{ marginRight: 4 }} />
            <Text style={styles.savantLinkText}>View on Savant</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  videoArea: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#000",
  },
  video: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0a0a0a",
  },
  info: {
    padding: 12,
  },
  infoTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  playerName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    marginRight: 10,
  },
  wpa: {
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  eventText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 3,
  },
  desc: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  savantLink: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  savantLinkText: {
    color: colors.textMuted,
    fontSize: 11,
  },
});
