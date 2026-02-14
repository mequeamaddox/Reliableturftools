import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { apiRequest } from "@/lib/query-client";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#16a34a",
    });
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch {
    return null;
  }
}

export async function savePushTokenToServer(token: string): Promise<void> {
  try {
    await apiRequest("POST", "/api/auth/push-token", { pushToken: token });
  } catch (err) {
    console.warn("Failed to save push token:", err);
  }
}

export async function scheduleFollowUpReminder(
  followUpId: string,
  buyerName: string,
  dueDate: Date,
  message?: string,
): Promise<string | null> {
  const now = new Date();
  if (dueDate <= now) return null;

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Follow-Up Reminder",
      body: buyerName
        ? `Time to follow up with ${buyerName}${message ? ": " + message.substring(0, 60) : ""}`
        : `You have a follow-up due${message ? ": " + message.substring(0, 60) : ""}`,
      data: { type: "followup", followUpId },
      sound: "default",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: dueDate,
    },
  });
  return identifier;
}

export async function cancelFollowUpReminder(identifier: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {}
}

export async function cancelAllFollowUpReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
