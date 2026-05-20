import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCardSession,
  useReviewCard,
  getGetCardSessionQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;

type CardData = {
  id: number;
  text: string;
  createdAt: string;
  question?: string;
};

function formatCardDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function FlipCard({
  card,
  onSwipeLeft,
  onSwipeRight,
}: {
  card: CardData;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  const colors = useColors();

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const flipProgress = useSharedValue(0);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      {
        rotate: `${interpolate(
          translateX.value,
          [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
          [-8, 0, 8],
          Extrapolation.CLAMP,
        )}deg`,
      },
    ],
  }));

  const frontStyle = useAnimatedStyle(() => ({
    opacity: flipProgress.value < 0.5 ? 1 : 0,
    transform: [
      { perspective: 1200 },
      {
        rotateY: `${interpolate(flipProgress.value, [0, 1], [0, 180])}deg`,
      },
    ],
  }));

  const backStyle = useAnimatedStyle(() => ({
    opacity: flipProgress.value >= 0.5 ? 1 : 0,
    transform: [
      { perspective: 1200 },
      {
        rotateY: `${interpolate(flipProgress.value, [0, 1], [180, 360])}deg`,
      },
    ],
  }));

  const greenOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 0.5],
      Extrapolation.CLAMP,
    ),
  }));

  const redOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [0.5, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const rememberLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [SWIPE_THRESHOLD * 0.4, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const forgotLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 0.4],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.15;
    })
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(
          SCREEN_WIDTH * 1.5,
          { duration: 260 },
          (finished) => {
            if (finished) runOnJS(onSwipeRight)();
          },
        );
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(
          -SCREEN_WIDTH * 1.5,
          { duration: 260 },
          (finished) => {
            if (finished) runOnJS(onSwipeLeft)();
          },
        );
      } else {
        translateX.value = withSpring(0, { damping: 15 });
        translateY.value = withSpring(0, { damping: 15 });
      }
    });

  const tap = Gesture.Tap().onEnd(() => {
    const toValue = flipProgress.value < 0.5 ? 1 : 0;
    flipProgress.value = withSpring(toValue, { damping: 10, stiffness: 100 });
  });

  const composed = Gesture.Race(pan, tap);

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.cardContainer, cardStyle]}>
        {/* Swipe labels */}
        <Animated.View
          style={[styles.swipeLabel, styles.swipeLabelRight, rememberLabelStyle]}
          pointerEvents="none"
        >
          <Text style={styles.swipeLabelTextGreen}>✓ Got it</Text>
        </Animated.View>
        <Animated.View
          style={[styles.swipeLabel, styles.swipeLabelLeft, forgotLabelStyle]}
          pointerEvents="none"
        >
          <Text style={styles.swipeLabelTextRed}>✗ Forgot</Text>
        </Animated.View>

        {/* Front face */}
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
            frontStyle,
          ]}
        >
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.colorOverlay, { backgroundColor: "#22c55e" }, greenOverlayStyle]}
            pointerEvents="none"
          />
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.colorOverlay, { backgroundColor: "#ef4444" }, redOverlayStyle]}
            pointerEvents="none"
          />
          <View style={styles.cardBadge}>
            <Text style={[styles.cardBadgeText, { color: colors.mutedForeground }]}>
              {formatCardDate(card.createdAt)}
            </Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={[styles.cardPrompt, { color: colors.mutedForeground }]}>
              {card.question || "What did you learn here?"}
            </Text>
          </View>
          <View style={styles.cardHint}>
            <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
            <Text style={[styles.cardHintText, { color: colors.mutedForeground }]}>
              Tap to reveal
            </Text>
          </View>
        </Animated.View>

        {/* Back face */}
        <Animated.View
          style={[
            styles.card,
            styles.cardBack,
            { backgroundColor: colors.card, borderColor: colors.primary },
            backStyle,
          ]}
        >
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.colorOverlay, { backgroundColor: "#22c55e" }, greenOverlayStyle]}
            pointerEvents="none"
          />
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.colorOverlay, { backgroundColor: "#ef4444" }, redOverlayStyle]}
            pointerEvents="none"
          />
          <View style={styles.cardBadge}>
            <Text style={[styles.cardBadgeText, { color: colors.primary }]}>
              {formatCardDate(card.createdAt)}
            </Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={[styles.cardText, { color: colors.foreground }]}>
              {card.text}
            </Text>
          </View>
          <View style={styles.cardHint}>
            <Feather name="arrow-left" size={13} color={colors.mutedForeground} />
            <Text style={[styles.cardHintText, { color: colors.mutedForeground }]}>
              Forgot
            </Text>
            <View style={{ flex: 1 }} />
            <Text style={[styles.cardHintText, { color: colors.mutedForeground }]}>
              Got it
            </Text>
            <Feather name="arrow-right" size={13} color={colors.mutedForeground} />
          </View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

function CompletionScreen({
  remembered,
  forgot,
  onGoAgain,
}: {
  remembered: number;
  forgot: number;
  onGoAgain: () => void;
}) {
  const colors = useColors();
  const total = remembered + forgot;
  return (
    <View style={[styles.completionContainer, { backgroundColor: colors.background }]}>
      <View style={[styles.completionIcon, { backgroundColor: colors.accent }]}>
        <Feather name="check-circle" size={36} color={colors.primary} />
      </View>
      <Text style={[styles.completionTitle, { color: colors.foreground }]}>
        Session complete
      </Text>
      <Text style={[styles.completionSub, { color: colors.mutedForeground }]}>
        {total} card{total !== 1 ? "s" : ""} reviewed
      </Text>
      <View style={styles.statsRow}>
        <View style={[styles.statPill, { backgroundColor: "#dcfce7" }]}>
          <Feather name="check" size={15} color="#16a34a" />
          <Text style={[styles.statPillText, { color: "#16a34a" }]}>
            {remembered} remembered
          </Text>
        </View>
        <View style={[styles.statPill, { backgroundColor: "#fee2e2" }]}>
          <Feather name="x" size={15} color="#dc2626" />
          <Text style={[styles.statPillText, { color: "#dc2626" }]}>
            {forgot} to revisit
          </Text>
        </View>
      </View>
      {forgot > 0 && (
        <Text style={[styles.revisitNote, { color: colors.mutedForeground }]}>
          Forgotten cards will appear first next session.
        </Text>
      )}
      <Pressable
        onPress={onGoAgain}
        style={({ pressed }) => [
          styles.goAgainButton,
          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[styles.goAgainText, { color: "#fff" }]}>
          Start new session
        </Text>
      </Pressable>
    </View>
  );
}

export default function QuizScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useGetCardSession();
  const { mutate: recordReview } = useReviewCard();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [remembered, setRemembered] = useState(0);
  const [forgot, setForgot] = useState(0);

  const cards = (data ?? []).filter((c) => !c.skipped);
  const isDone = !isLoading && cards.length > 0 && currentIndex >= cards.length;
  const isEmpty = !isLoading && cards.length === 0;
  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 8;

  const handleResult = useCallback(
    (result: "remembered" | "forgot") => {
      const card = cards[currentIndex];
      if (!card) return;
      recordReview({ responseId: card.id, data: { result } });
      if (result === "remembered") setRemembered((n) => n + 1);
      else setForgot((n) => n + 1);
      setCurrentIndex((i) => i + 1);
    },
    [cards, currentIndex, recordReview],
  );

  const handleGoAgain = useCallback(async () => {
    setCurrentIndex(0);
    setRemembered(0);
    setForgot(0);
    await queryClient.invalidateQueries({
      queryKey: getGetCardSessionQueryKey(),
    });
    refetch();
  }, [queryClient, refetch]);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="wifi-off" size={32} color={colors.mutedForeground} />
        <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
          Couldn't load cards. Check your connection.
        </Text>
        <Pressable onPress={() => refetch()}>
          <Text style={[styles.retryText, { color: colors.primary }]}>
            Retry
          </Text>
        </Pressable>
      </View>
    );
  }

  if (isDone) {
    return (
      <CompletionScreen
        remembered={remembered}
        forgot={forgot}
        onGoAgain={handleGoAgain}
      />
    );
  }

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.background,
          paddingTop: topPad,
          paddingBottom: Platform.OS === "web" ? 84 + 16 : Math.max(insets.bottom, 16),
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
          QUIZ
        </Text>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Test your{"\n"}memory.
        </Text>
      </View>

      {isEmpty ? (
        <View style={styles.emptyContainer}>
          <View
            style={[styles.emptyIcon, { backgroundColor: colors.accent }]}
          >
            <Feather
              name="layers"
              size={28}
              color={colors.accentForeground}
            />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            No entries to review
          </Text>
          <Text
            style={[styles.emptyBody, { color: colors.mutedForeground }]}
          >
            Capture a few things you've learned and they'll show up here for
            review.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.progress}>
            <Text
              style={[styles.progressText, { color: colors.mutedForeground }]}
            >
              {currentIndex + 1} / {cards.length}
            </Text>
            <View
              style={[styles.progressBar, { backgroundColor: colors.muted }]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: colors.primary,
                    width: `${((currentIndex + 1) / cards.length) * 100}%`,
                  },
                ]}
              />
            </View>
          </View>

          {/* Card area — fills remaining space */}
          <View style={styles.cardArea}>
            {cards[currentIndex + 1] && (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  styles.shadowCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              />
            )}
            {cards[currentIndex] && (
              <FlipCard
                key={cards[currentIndex]!.id}
                card={cards[currentIndex]!}
                onSwipeLeft={() => handleResult("forgot")}
                onSwipeRight={() => handleResult("remembered")}
              />
            )}
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <Pressable
              onPress={() => handleResult("forgot")}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.actionBtnForgot,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="x" size={22} color="#ef4444" />
              <Text style={[styles.actionBtnText, { color: "#ef4444" }]}>
                Forgot
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleResult("remembered")}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.actionBtnRemember,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="check" size={22} color="#16a34a" />
              <Text style={[styles.actionBtnText, { color: "#16a34a" }]}>
                Got it
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  header: {
    marginBottom: 20,
  },
  eyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  progress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  progressText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    width: 48,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  cardArea: {
    flex: 1,
    marginBottom: 12,
  },
  cardContainer: {
    borderRadius: 24,
  },
  shadowCard: {
    borderWidth: 1,
    borderRadius: 24,
    top: 7,
    transform: [{ scale: 0.96 }],
  },
  card: {
    position: "absolute",
    inset: 0,
    borderWidth: 1,
    borderRadius: 24,
    padding: 24,
    backfaceVisibility: "hidden",
    overflow: "hidden",
  },
  cardBack: {
    borderWidth: 2,
  },
  colorOverlay: {
    borderRadius: 24,
  },
  cardBadge: {
    marginBottom: 16,
  },
  cardBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  cardBody: {
    flex: 1,
    justifyContent: "center",
  },
  cardPrompt: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 22,
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  cardText: {
    fontFamily: "Inter_500Medium",
    fontSize: 17,
    lineHeight: 26,
  },
  cardHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  cardHintText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  swipeLabel: {
    position: "absolute",
    top: 24,
    zIndex: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 2,
  },
  swipeLabelRight: {
    right: 20,
    borderColor: "#16a34a",
    backgroundColor: "#dcfce7",
  },
  swipeLabelLeft: {
    left: 20,
    borderColor: "#dc2626",
    backgroundColor: "#fee2e2",
  },
  swipeLabelTextGreen: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#15803d",
  },
  swipeLabelTextRed: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#dc2626",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  actionBtnForgot: {
    borderColor: "#fca5a5",
    backgroundColor: "#fff1f2",
  },
  actionBtnRemember: {
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
  },
  actionBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
  },
  retryText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
  },
  emptyBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  completionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  completionIcon: {
    width: 80,
    height: 80,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  completionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    letterSpacing: -0.4,
  },
  completionSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statPillText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  revisitNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 4,
  },
  goAgainButton: {
    marginTop: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
  },
  goAgainText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
});
