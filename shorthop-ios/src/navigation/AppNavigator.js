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
import SettingsScreen from "../screens/SettingsScreen";

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: "#0D0D0D" },
  animation: "slide_from_right",
};

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

  // Splash/loading while auth state is being determined
  if (user === undefined) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={screenOptions}>
        {!user ? (
          // Not signed in
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
        ) : !hasTeam ? (
          // Signed in but no team picked yet
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            // After saving team, refresh by detecting profile change
            listeners={{
              focus: async () => {
                const profile = await getUserProfile().catch(() => null);
                if (profile?.favoriteTeam) setHasTeam(true);
              },
            }}
          />
        ) : (
          // Fully onboarded — main app
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Day" component={DayScreen} />
            <Stack.Screen name="AddMoment" component={AddMomentScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
