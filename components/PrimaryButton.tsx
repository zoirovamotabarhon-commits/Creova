import {
  Pressable,
  Text,
  StyleSheet,
} from "react-native";

import { useTheme } from "../hooks/useTheme";

type Props = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
};

export default function PrimaryButton({
  title,
  onPress,
  disabled = false,
}: Props) {
  const { colors } = useTheme();

  return (
    <Pressable
      style={[
        styles.button,
        {
          backgroundColor:
            colors.primary,
        },
        disabled &&
          styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.text}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  disabled: {
    opacity: 0.6,
  },

  text: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
