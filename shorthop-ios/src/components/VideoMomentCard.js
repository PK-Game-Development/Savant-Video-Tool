/**
 * VideoMomentCard — moment card with video thumbnail and tap-to-play.
 *
 * Video is streamed through the Flask proxy (/api/stream) so the MLB CDN
 * headers are handled server-side rather than relying on iOS AVPlayer to
 * forward them.  The first frame is pulled via expo-video-thumbnails and
 * shown as a poster until the user taps play.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
  Image,
  ActivityIndicator,
} from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import * as VideoThumbnails from "expo-video-thumbnails";
import { Ionicons } from "@expo/vector-icons";
import colors from "../constants/colors";
import { eventLabel } from "../constants/teams";
import { API_BASE } from "../services/savantApi";

function proxyUrl(gamePk, playId) {
  return `${API_BASE}/api/stream/${playId}?game_pk=${gamePk}`;
}

export default function VideoMomentCard({ moment, onLongPress }) {
  const [active, setActive] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [thumbnail, setThumbnail] = useState(null);
  const [thumbLoading, setThumbLoading] = useState(true);
  const didActivate = useRef(false);

  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.muted = false;
  });

  // Generate thumbnail from proxy stream on mount
  useEffect(() => {
    if (!moment.gamePk || !moment.playId) {
      setThumbLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(
          proxyUrl(moment.gamePk, moment.playId),
          { time: 0 }
        );
        if (!cancelled) setThumbnail(uri);
      } catch {
        // no thumbnail — plain dark background is fine
      } finally {
        if (!cancelled) setThumbLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [moment.gamePk, moment.playId]);

  // Status listener for play/error handling
  useEffect(() => {
    const sub = player.addListener("statusChange", ({ status, error }) => {
      if (status === "error" || error) {
        setHasError(true);
      } else if (status === "readyToPlay" && didActivate.current) {
        player.play();
      }
    });
    return () => sub.remove();
  }, [player]);

  function activate() {
    if (!moment.gamePk || !moment.playId) {
      setHasError(true);
      return;
    }
    didActivate.current = true;
    setHasError(false);
    setActive(true);
    player
      .replaceAsync({ uri: proxyUrl(moment.gamePk, moment.playId) })
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
    <View style={styles.card}>
      {/* 16:9 video area */}
      {active && !hasError ? (
        <View style={styles.videoArea}>
          <VideoView
            player={player}
            style={styles.video}
            nativeControls
            allowsPictureInPicture
            contentFit="contain"
          />
        </View>
      ) : (
        <TouchableOpacity
          style={styles.videoArea}
          onPress={activate}
          onLongPress={onLongPress}
          activeOpacity={0.85}
        >
          {/* Thumbnail or dark background */}
          {thumbnail ? (
            <Image source={{ uri: thumbnail }} style={styles.thumbnail} resizeMode="cover" />
          ) : (
            <View style={styles.thumbnailPlaceholder} />
          )}

          {/* Overlay */}
          <View style={styles.overlay}>
            {hasError ? (
              <Ionicons name="alert-circle-outline" size={30} color={colors.textMuted} />
            ) : thumbLoading ? (
              <ActivityIndicator color="rgba(255,255,255,0.6)" />
            ) : (
              <View style={styles.playButton}>
                <Ionicons name="play" size={26} color="#fff" style={{ marginLeft: 3 }} />
              </View>
            )}
          </View>
        </TouchableOpacity>
      )}

      {/* Metadata */}
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
            <Ionicons
              name="open-outline"
              size={12}
              color={colors.textMuted}
              style={{ marginRight: 4 }}
            />
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
  thumbnail: {
    ...StyleSheet.absoluteFillObject,
  },
  thumbnailPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0d0d0d",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
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
