/**
 * AppNavigator — switches between AuthStack and MainStack based on Firebase auth state
 * and whether the user has completed onboarding (favoriteTeam set).
 */

import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../services/firebase";
import { getUserProfile } from "../services/moments";

import WelcomeScreen from "../screens/WelcomeScreen";
import OnboardingScreen from "../screens/OnboardingScreen";
import HomeScreen from "../screens/HomeScreen";
import DayScreen from "../screens/DayScreen";
import AddMomentScreen from "../screens/AddMomentScreen";
import GamePlaysScreen from "../screens/GamePlaysScreen";
import SettingsScreen from "../screens/SettingsScreen";

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: "#0D0D0D" },
  animation: "slide_from_right",
};

function dayOptions({ route }) {
  return {
    animation: route.params?.direction === "backward" ? "slide_from_left" : "slide_from_right",
  };
}

export default function AppNavigator() {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [hasTeam, setHasTeam] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const profile = await getUserProfile();
          setHasTeam(!!profile?.favoriteTeam);
        } catch {
          setHasTeam(false);
        }
      } else {
        setHasTeam(false);
      }
    });
    return unsubscribe;
  }, []);

  // DEV: bypass auth when EXPO_PUBLIC_SKIP_AUTH=true in .env
  if (process.env.EXPO_PUBLIC_SKIP_AUTH === "true") {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={screenOptions}>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Day" component={DayScreen} options={dayOptions} />
          <Stack.Screen name="AddMoment" component={AddMomentScreen} />
          <Stack.Screen name="GamePlays" component={GamePlaysScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  // Splash/loading while auth state is being determined
  if (user === undefined) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={screenOptions}>
        {!user ? (
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
        ) : !hasTeam ? (
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            listeners={{
              focus: async () => {
                const profile = await getUserProfile().catch(() => null);
                if (profile?.favoriteTeam) setHasTeam(true);
              },
            }}
          />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Day" component={DayScreen} options={dayOptions} />
            <Stack.Screen name="AddMoment" component={AddMomentScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
