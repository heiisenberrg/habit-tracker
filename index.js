/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import BackgroundFetch from 'react-native-background-fetch';
import App from './App';
import { name as appName } from './app.json';
import { runBackgroundAppLockCheck } from './src/services/appLock';
import { registerBackgroundHandler } from './src/services/notifications';
import { runBackgroundRainCheck } from './src/services/rainAlerts';

registerBackgroundHandler();

// iOS wakes the app a few times a day (Background App Refresh); each wake
// re-checks the forecast against today's schedule. Timing is at the OS's
// discretion — app-open checks and pre-scheduled warnings fill the gaps.
BackgroundFetch.configure(
  {
    minimumFetchInterval: 15,
    stopOnTerminate: false,
    startOnBoot: true,
    enableHeadless: true,
  },
  async taskId => {
    await runBackgroundRainCheck();
    await runBackgroundAppLockCheck();
    BackgroundFetch.finish(taskId);
  },
  taskId => BackgroundFetch.finish(taskId),
).catch(() => {
  // Background refresh unavailable (restricted/disabled); foreground
  // checks still run.
});

// Android: keep checks running after the app is swiped away.
BackgroundFetch.registerHeadlessTask(async event => {
  await runBackgroundRainCheck();
  await runBackgroundAppLockCheck();
  BackgroundFetch.finish(event.taskId);
});

AppRegistry.registerComponent(appName, () => App);
