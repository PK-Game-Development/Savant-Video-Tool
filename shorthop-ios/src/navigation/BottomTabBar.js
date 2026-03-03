import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Rect, Line, Polygon, Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import colors from "../constants/colors";

const ACTIVE = "#999999";
const INACTIVE = "#444444";

// Calendar with a home plate (pentagon) centered in the body
function CalendarHomePlateIcon({ color, size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Calendar outer rect */}
      <Rect
        x="2" y="3" width="20" height="18" rx="2"
        stroke={color} strokeWidth="1.5" fill="none"
      />
      {/* Header divider */}
      <Line x1="2" y1="8" x2="22" y2="8" stroke={color} strokeWidth="1.5" />
      {/* Left knob */}
      <Line
        x1="8" y1="1" x2="8" y2="5"
        stroke={color} strokeWidth="1.5" strokeLinecap="round"
      />
      {/* Right knob */}
      <Line
        x1="16" y1="1" x2="16" y2="5"
        stroke={color} strokeWidth="1.5" strokeLinecap="round"
      />
      {/* Home plate pentagon — point at bottom */}
      <Polygon
        points="9,11 15,11 15,15 12,18.5 9,15"
        fill={color}
      />
    </Svg>
  );
}

// Bulleted list — three dot + line rows
function BulletListIcon({ color, size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="4.5" cy="7" r="1.5" fill={color} />
      <Line x1="8" y1="7" x2="20" y2="7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Circle cx="4.5" cy="12" r="1.5" fill={color} />
      <Line x1="8" y1="12" x2="20" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Circle cx="4.5" cy="17" r="1.5" fill={color} />
      <Line x1="8" y1="17" x2="20" y2="17" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

export default function BottomTabBar({ state, navigation, insets }) {
  const activeTab = state.routes[state.index].name;
  const bottomPad = Math.max(insets?.bottom ?? 0, 8);

  function press(tabName) {
    const route = state.routes.find((r) => r.name === tabName);
    const event = navigation.emit({
      type: "tabPress",
      target: route?.key,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented) {
      navigation.navigate(tabName);
    }
  }

  function iconColor(tabName) {
    return activeTab === tabName ? ACTIVE : INACTIVE;
  }

  return (
    <View style={[styles.container, { paddingBottom: bottomPad }]}>
      <TouchableOpacity style={styles.tab} onPress={() => press("Home")} activeOpacity={0.6}>
        <CalendarHomePlateIcon size={26} color={iconColor("Home")} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.tab} onPress={() => press("SavedMoments")} activeOpacity={0.6}>
        <BulletListIcon size={26} color={iconColor("SavedMoments")} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.tab} onPress={() => press("Profile")} activeOpacity={0.6}>
        <Ionicons name="person-outline" size={26} color={iconColor("Profile")} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 12,
  },
});
