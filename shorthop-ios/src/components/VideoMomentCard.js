/**
 * VideoMomentCard — moment card with video thumbnail and tap-to-play.
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
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
import { eventLabel } from "../constants/teams";
import { API_BASE } from "../services/savantApi";
import { useTheme } from "../context/ThemeContext";
import SituationGraphic from "./SituationGraphic";

const MOMENT_BG = "#1F1F1F";

function formatMomentDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function proxyUrl(gamePk, playId) {
  return `${API_BASE}/api/stream/${playId}?game_pk=${gamePk}`;
}

export default function VideoMomentCard({ moment, onLongPress }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [active, setActive] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [thumbnail, setThumbnail] = useState(null);
  const [thumbLoading, setThumbLoading] = useState(true);
  const didActivate = useRef(false);

  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.muted = false;
  });

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
        // no thumbnail
      } finally {
        if (!cancelled) setThumbLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [moment.gamePk, moment.playId]);

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
    player.replaceAsync({ uri: proxyUrl(moment.gamePk, moment.playId) }).catch(() => setHasError(true));
  }

  function openInBrowser() {
    if (moment.savantUrl) {
      Linking.openURL(moment.savantUrl).catch(() => Alert.alert("Could not open link"));
    }
  }

  const label = eventLabel(moment.event);
  const dateLabel = formatMomentDate(moment.date);

  return (
    <View style={styles.card}>
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
          {thumbnail ? (
            <Image source={{ uri: thumbnail }} style={styles.thumbnail} resizeMode="cover" />
          ) : (
            <View style={styles.thumbnailPlaceholder} />
          )}

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

      <View style={styles.infoRow}>
        <View style={styles.leftCol}>
          <Text style={styles.playerName} numberOfLines={1}>
            {moment.playerName}
          </Text>
          <SituationGraphic moment={moment} colors={colors} />
        </View>

        <View style={styles.rightCol}>
          <Text style={styles.eventText} numberOfLines={1}>
            {label}
          </Text>
          <Text style={styles.dateText}>{dateLabel}</Text>
          <Text style={styles.matchup} numberOfLines={1}>
            {moment.battingTeam} vs {moment.pitchingTeam}
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
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    card: {
      backgroundColor: MOMENT_BG,
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
    infoRow: {
      flexDirection: "row",
      gap: 12,
      padding: 12,
    },
    leftCol: {
      width: 128,
    },
    rightCol: {
      flex: 1,
    },
    playerName: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
    },
    eventText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "600",
      marginBottom: 2,
    },
    dateText: {
      color: colors.textSecondary,
      fontSize: 12,
      marginBottom: 2,
    },
    matchup: {
      color: colors.textMuted,
      fontSize: 12,
      marginBottom: 4,
    },
    desc: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 1,
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
}
