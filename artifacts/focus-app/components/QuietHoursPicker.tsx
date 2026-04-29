import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

import { useColors } from "@/hooks/useColors";

function parseHM(value: string): Date {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  const d = new Date();
  d.setSeconds(0, 0);
  if (match) {
    d.setHours(Number(match[1]), Number(match[2]));
  } else {
    d.setHours(22, 0);
  }
  return d;
}

function formatHM(d: Date): string {
  return `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

function formatDisplay(value: string): string {
  const d = parseHM(value);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TimeField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") {
      setPickerOpen(false);
    }
    if (event.type === "dismissed") return;
    if (selected) {
      onChange(formatHM(selected));
    }
  };

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Pressable
        onPress={() => !disabled && setPickerOpen(true)}
        style={({ pressed }) => [
          styles.pill,
          {
            backgroundColor: disabled ? colors.muted : colors.secondary,
            borderColor: colors.border,
            opacity: pressed && !disabled ? 0.85 : 1,
          },
        ]}
      >
        <Feather
          name="clock"
          size={14}
          color={disabled ? colors.mutedForeground : colors.secondaryForeground}
        />
        <Text
          style={[
            styles.pillText,
            {
              color: disabled
                ? colors.mutedForeground
                : colors.secondaryForeground,
            },
          ]}
        >
          {formatDisplay(value)}
        </Text>
      </Pressable>
      {pickerOpen && (
        <DateTimePicker
          value={parseHM(value)}
          mode="time"
          is24Hour={false}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleChange}
        />
      )}
      {Platform.OS === "ios" && pickerOpen && (
        <Pressable
          onPress={() => setPickerOpen(false)}
          style={({ pressed }) => [
            styles.doneButton,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.doneText,
              { color: colors.primaryForeground },
            ]}
          >
            Done
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
    gap: 6,
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  pillText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  doneButton: {
    alignSelf: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 8,
  },
  doneText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
});
