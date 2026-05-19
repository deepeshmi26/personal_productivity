import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
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
const SWIPE_OUT_DURATION = 260;

type CardData = {
  id: number;
  text: string;
  createdAt: string;
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
  const swipeX = useRef(new Animated.Value(0)).current;
  const swipeY = useRef(new Animated.Value(0)).current;
  const flipAnim = useRef(new Animated.Value(0)).current;
  const [isFlipped, setIsFlipped] = useState(false);

  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const backRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["180deg", "360deg"],
  });
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });
  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  const cardRotation = swipeX.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ["-8deg", "0deg", "8deg"],
    extrapolate: "clamp",
  });

  const greenOverlay = swipeX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 0.5],
    extrapolate: "clamp",
  });
  const redOverlay = swipeX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [0.5, 0],
    extrapolate: "clamp",
  });
  const rememberLabelOpacity = swipeX.interpolate({
    inputRange: [SWIPE_THRESHOLD * 0.4, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const forgotLabelOpacity = swipeX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 0.4],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const forceSwipe = useCallback(
    (direction: "left" | "right") => {
      const x = direction === "right" ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
      Animated.timing(swipeX, {
        toValue: x,
        duration: SWIPE_OUT_DURATION,
        useNativeDriver: true,
      }).start(() => {
        if (direction === "right") onSwipeRight();
        else onSwipeLeft();
      });
    },
    [swipeX, onSwipeLeft, onSwipeRight],
  );

  const resetPosition = useCallback(() => {
    Animated.spring(swipeX, {
      toValue: 0,
      useNativeDriver: true,
      friction: 5,
    }).start();
    Animated.spring(swipeY, {
      toValue: 0,
      useNativeDriver: true,
      friction: 5,
    }).start();
  }, [swipeX, swipeY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        swipeX.setValue(g.dx);
        swipeY.setValue(g.dy * 0.15);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_THRESHOLD) {
          forceSwipe("right");
        } else if (g.dx < -SWIPE_THRESHOLD) {
          forceSwipe("left");
        } else {
          resetPosition();
        }
      },
    }),
  ).current;

  const handleFlip = useCallback(() => {
    const toValue = isFlipped ? 0 : 1;
    Animated.spring(flipAnim, {
      toValue,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
    setIsFlipped(!isFlipped);
  }, [isFlipped, flipAnim]);

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        {
          transform: [
            { translateX: swipeX },
            { translateY: swipeY },
            { rotate: cardRotation },
          ],
        },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Remember label */}
      <Animated.View
        style={[
          styles.swipeLabel,
          styles.swipeLabelRight,
          { opacity: rememberLabelOpacity },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.swipeLabelText}>✓ Got it</Text>
      </Animated.View>

      {/* Forgot label */}
      <Animated.View
        style={[
          styles.swipeLabel,
          styles.swipeLabelLeft,
          { opacity: forgotLabelOpacity },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.swipeLabelText}>✗ Forgot</Text>
      </Animated.View>

      <Pressable onPress={handleFlip} style={{ flex: 1 }}>
        {/* Front face */}
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: frontOpacity,
              transform: [{ perspective: 1200 }, { rotateY: frontRotate }],
            },
          ]}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.colorOverlay,
              { backgroundColor: "#22c55e", opacity: greenOverlay },
            ]}
          />
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.colorOverlay,
              { backgroundColor: "#ef4444", opacity: redOverlay },
            ]}
          />
          <View style={styles.cardBadge}>
            <Text style={[styles.cardBadgeText, { color: colors.mutedForeground }]}>
              {formatCardDate(card.createdAt)}
            </Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={[styles.cardPrompt, { color: colors.mutedForeground }]}>
              What did you learn here?
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
            {
              backgroundColor: colors.card,
              borderColor: colors.primary,
              opacity: backOpacity,
              transform: [{ perspective: 1200 }, { rotateY: backRotate }],
            },
          ]}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.colorOverlay,
              { backgroundColor: "#22c55e", opacity: greenOverlay },
            ]}
          />
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.colorOverlay,
              { backgroundColor: "#ef4444", opacity: redOverlay },
            ]}
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
      </Pressable>
    </Animated.View>
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

      <View style={[styles.statsRow]}>
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
        <Text style={[styles.goAgainText, { color: "#fff" }]}>Start new session</Text>
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
    await queryClient.invalidateQueries({ queryKey: getGetCardSessionQueryKey() });
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
          <Text style={[styles.retryText, { color: colors.primary }]}>Retry</Text>
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
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>QUIZ</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Test your{"\n"}memory.
        </Text>
      </View>

      {isEmpty ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.accent }]}>
            <Feather name="layers" size={28} color={colors.accentForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            No entries to review
          </Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
            Capture a few things you've learned and they'll show up here for review.
          </Text>
        </View>
      ) : (
        <>
          {/* Progress */}
          <View style={styles.progress}>
            <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
              {currentIndex + 1} / {cards.length}
            </Text>
            <View style={[styles.progressBar, { backgroundColor: colors.muted }]}>
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

          {/* Stack shadow cards */}
          {cards[currentIndex + 1] && (
            <View
              style={[
                styles.cardContainer,
                styles.shadowCard2,
                { backgroundColor: colors.card, borderColor: colors.border },
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
              <Text style={[styles.actionBtnText, { color: "#ef4444" }]}>Forgot</Text>
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
              <Text style={[styles.actionBtnText, { color: "#16a34a" }]}>Got it</Text>
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
  cardContainer: {
    position: "absolute",
    left: 20,
    right: 20,
    top: Platform.OS === "web" ? 200 : 190,
    bottom: 140,
    borderRadius: 24,
  },
  shadowCard2: {
    borderWidth: 1,
    borderRadius: 24,
    top: Platform.OS === "web" ? 207 : 197,
    bottom: 133,
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
  swipeLabelText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#15803d",
  },
  actions: {
    position: "absolute",
    bottom: 32,
    left: 20,
    right: 20,
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
