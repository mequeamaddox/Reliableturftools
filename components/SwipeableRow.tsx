import React, { useRef } from "react";
import { View, Text, StyleSheet, Animated, Pressable } from "react-native";
import { Swipeable, RectButton } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

interface SwipeAction {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  onPress: () => void;
}

interface SwipeableRowProps {
  children: React.ReactNode;
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
}

export default function SwipeableRow({ children, leftAction, rightAction }: SwipeableRowProps) {
  const swipeRef = useRef<Swipeable>(null);

  function close() {
    swipeRef.current?.close();
  }

  function renderLeftActions(progress: Animated.AnimatedInterpolation<number>) {
    if (!leftAction) return null;
    const trans = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [-80, 0],
    });
    return (
      <Animated.View style={[styles.leftAction, { transform: [{ translateX: trans }] }]}>
        <RectButton
          style={[styles.actionBtn, { backgroundColor: leftAction.color }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            close();
            leftAction.onPress();
          }}
        >
          <Ionicons name={leftAction.icon} size={22} color="#fff" />
          <Text style={styles.actionText}>{leftAction.label}</Text>
        </RectButton>
      </Animated.View>
    );
  }

  function renderRightActions(progress: Animated.AnimatedInterpolation<number>) {
    if (!rightAction) return null;
    const trans = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [80, 0],
    });
    return (
      <Animated.View style={[styles.rightAction, { transform: [{ translateX: trans }] }]}>
        <RectButton
          style={[styles.actionBtn, { backgroundColor: rightAction.color }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            close();
            rightAction.onPress();
          }}
        >
          <Ionicons name={rightAction.icon} size={22} color="#fff" />
          <Text style={styles.actionText}>{rightAction.label}</Text>
        </RectButton>
      </Animated.View>
    );
  }

  return (
    <Swipeable
      ref={swipeRef}
      renderLeftActions={leftAction ? renderLeftActions : undefined}
      renderRightActions={rightAction ? renderRightActions : undefined}
      leftThreshold={40}
      rightThreshold={40}
      overshootLeft={false}
      overshootRight={false}
      friction={2}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  leftAction: {
    width: 80,
    marginBottom: 10,
  },
  rightAction: {
    width: 80,
    marginBottom: 10,
  },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    gap: 4,
  },
  actionText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: "#fff",
  },
});
