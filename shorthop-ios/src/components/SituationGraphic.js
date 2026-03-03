import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";

export default function SituationGraphic({ moment, colors }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const inning = Number(moment?.inning) || 0;
  const half = (moment?.halfInning || "").toLowerCase();
  const outs = Number.isFinite(Number(moment?.outs)) ? Number(moment?.outs) : null;
  const balls = Number.isFinite(Number(moment?.balls)) ? Number(moment?.balls) : null;
  const strikes = Number.isFinite(Number(moment?.strikes)) ? Number(moment?.strikes) : null;

  const onFirst = Boolean(moment?.onFirst);
  const onSecond = Boolean(moment?.onSecond);
  const onThird = Boolean(moment?.onThird);

  const inningLabel = inning > 0 ? `${half === "top" ? "Top" : half === "bottom" || half === "bot" ? "Bot" : ""} ${inning}`.trim() : "—";
  const outsLabel = outs === null ? "Outs —" : `Outs ${outs}`;
  const countLabel = balls === null || strikes === null ? "Count —" : `Count ${balls}-${strikes}`;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.meta}>{inningLabel}</Text>
        <Text style={styles.meta}>{outsLabel}</Text>
      </View>
      <View style={styles.diamondWrap}>
        <View style={[styles.base, styles.baseSecond, onSecond && styles.baseOn]} />
        <View style={[styles.base, styles.baseThird, onThird && styles.baseOn]} />
        <View style={[styles.base, styles.baseFirst, onFirst && styles.baseOn]} />
        <View style={[styles.base, styles.baseHome]} />
      </View>
      <Text style={styles.meta}>{countLabel}</Text>
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    wrap: {
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    meta: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "600",
      letterSpacing: 0.3,
    },
    diamondWrap: {
      alignSelf: "center",
      width: 44,
      height: 32,
      marginBottom: 6,
    },
    base: {
      position: "absolute",
      width: 8,
      height: 8,
      borderWidth: 1,
      borderColor: colors.textSecondary,
      backgroundColor: "transparent",
      transform: [{ rotate: "45deg" }],
    },
    baseOn: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    baseSecond: {
      top: 0,
      left: 18,
    },
    baseThird: {
      top: 10,
      left: 7,
    },
    baseFirst: {
      top: 10,
      left: 29,
    },
    baseHome: {
      top: 20,
      left: 18,
      borderColor: colors.textMuted,
    },
  });
}

