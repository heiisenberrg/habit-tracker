import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import TabBar from '../components/TabBar';
import ActivityScreen from '../screens/ActivityScreen';
import CalendarScreen from '../screens/CalendarScreen';
import ChallengeDetailScreen from '../screens/ChallengeDetailScreen';
import CreateAccountScreen from '../screens/CreateAccountScreen';
import CreateCustomHabitScreen from '../screens/CreateCustomHabitScreen';
import EmailAuthScreen from '../screens/EmailAuthScreen';
import HabitDetailScreen from '../screens/HabitDetailScreen';
import HomeScreen from '../screens/HomeScreen';
import AssistantScreen from '../screens/AssistantScreen';
import NewGoodHabitScreen from '../screens/NewGoodHabitScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import ProfileScreen from '../screens/ProfileScreen';
import QuickActionsScreen from '../screens/QuickActionsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SplashScreen from '../screens/SplashScreen';
import GroceryInsightsScreen from '../screens/GroceryInsightsScreen';
import GroceryScreen from '../screens/GroceryScreen';
import QuoteOfDayScreen from '../screens/QuoteOfDayScreen';
import RememberDatesScreen from '../screens/RememberDatesScreen';
import ShopTripScreen from '../screens/ShopTripScreen';
import StoresScreen from '../screens/StoresScreen';
import TripDetailScreen from '../screens/TripDetailScreen';
import SuccessScreen from '../screens/SuccessScreen';

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  EmailAuth: undefined;
  CreateAccount: undefined;
  Main: undefined;
  QuoteOfDay: undefined;
  ShopTrip: { tripId: string };
  TripDetail: { tripId: string };
  GroceryInsights: undefined;
  Stores: undefined;
  QuickActions: { only?: 'mood' } | undefined;
  NewGoodHabit: undefined;
  Assistant: { flow?: 'habit' | 'task' | 'reminder' | 'quick' } | undefined;
  CreateCustomHabit: { kind?: 'build' | 'quit' } | undefined;
  ChallengeDetail: { id: string };
  Success: { title?: string } | undefined;
  Settings: undefined;
  Notifications: undefined;
  RememberDates: undefined;
  Calendar: undefined;
  HabitDetail: { id: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator();

// DEV screenshot aid: boot straight into a route for UI sweeps. Keep null.
const DEBUG_STACK_ROUTE: string | null = null;
const DEBUG_TAB_ROUTE: string | null = null;
const DEBUG_PARAMS: object | null = null;

function MainTabs() {
  return (
    <Tabs.Navigator
      tabBar={props => <TabBar {...props} />}
      initialRouteName={(__DEV__ ? (DEBUG_TAB_ROUTE as any) : null) ?? 'Home'}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Grocery" component={GroceryScreen} />
      <Tabs.Screen name="Activity" component={ActivityScreen} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={
          (__DEV__ ? (DEBUG_STACK_ROUTE as any) : null) ?? 'Splash'
        }
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="EmailAuth" component={EmailAuthScreen} />
        <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
        <Stack.Screen
          name="QuoteOfDay"
          component={QuoteOfDayScreen}
          options={{ animation: 'fade' }}
        />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Group
          screenOptions={{
            presentation: 'transparentModal',
            animation: 'fade',
          }}
        >
          <Stack.Screen name="QuickActions" component={QuickActionsScreen} />
        </Stack.Group>
        <Stack.Group screenOptions={{ presentation: 'modal' }}>
          <Stack.Screen name="Assistant" component={AssistantScreen} />
          <Stack.Screen name="NewGoodHabit" component={NewGoodHabitScreen} />
          <Stack.Screen
            name="CreateCustomHabit"
            component={CreateCustomHabitScreen}
          />
          <Stack.Screen name="Success" component={SuccessScreen} />
        </Stack.Group>
        <Stack.Screen
          name="ChallengeDetail"
          component={ChallengeDetailScreen}
          initialParams={(__DEV__ ? (DEBUG_PARAMS as any) : null) ?? undefined}
        />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="RememberDates" component={RememberDatesScreen} />
        <Stack.Screen name="Calendar" component={CalendarScreen} />
        <Stack.Screen name="ShopTrip" component={ShopTripScreen} />
        <Stack.Screen name="TripDetail" component={TripDetailScreen} />
        <Stack.Screen
          name="GroceryInsights"
          component={GroceryInsightsScreen}
        />
        <Stack.Screen name="Stores" component={StoresScreen} />
        <Stack.Screen
          name="HabitDetail"
          component={HabitDetailScreen}
          initialParams={(__DEV__ ? (DEBUG_PARAMS as any) : null) ?? undefined}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default RootNavigator;
