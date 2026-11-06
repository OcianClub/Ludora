import { forwardRef, memo, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type AccessibilityState,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { Icon, type IconName } from "@ludora/icons";
import { useTheme } from "../../contexts/ThemeContext";
import { createControlStyles } from "./styles";

type SearchProps = Omit<TextInputProps, "style" | "accessibilityLabel"> & {
  accessibilityLabel: string;
  containerStyle?: StyleProp<ViewStyle>;
};
export const SearchField = memo(
  forwardRef<TextInput, SearchProps>(function SearchField(
    {
      containerStyle,
      onFocus,
      onBlur,
      onChangeText,
      value,
      editable = true,
      ...props
    },
    ref,
  ) {
    const { colors } = useTheme();
    const s = useMemo(() => createControlStyles(colors), [colors]);
    const [focused, setFocused] = useState(false);
    return (
      <View
        style={[
          s.search,
          focused && s.focus,
          !editable && s.disabled,
          containerStyle,
        ]}
      >
        <Icon name="magnify" size={19} color={colors.textoSecundario} />
        <TextInput
          ref={ref}
          autoCorrect={false}
          returnKeyType="search"
          placeholderTextColor={colors.textoSecundario}
          {...props}
          value={value}
          editable={editable}
          onChangeText={onChangeText}
          style={s.input}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
        />
        {!!value && onChangeText && editable && (
          <TouchableOpacity
            style={s.clear}
            hitSlop={2}
            accessibilityRole="button"
            accessibilityLabel="Limpar busca"
            onPress={() => onChangeText("")}
          >
            <Icon name="close" size={18} color={colors.textoSecundario} />
          </TouchableOpacity>
        )}
      </View>
    );
  }),
);

type IconButtonProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
  variant?: "outline" | "filled" | "ghost";
  badge?: number;
  dot?: boolean;
  disabled?: boolean;
  state?: AccessibilityState;
  style?: StyleProp<ViewStyle>;
};
export const IconButton = memo(function IconButton({
  icon,
  label,
  onPress,
  variant = "outline",
  badge = 0,
  dot,
  disabled,
  state,
  style,
}: IconButtonProps) {
  const { colors } = useTheme();
  const s = useMemo(() => createControlStyles(colors), [colors]);
  const back = icon === "arrow-left";
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ ...state, disabled }}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.75}
      hitSlop={2}
      style={[
        s.icon,
        variant !== "ghost" && s[variant],
        back && s.back,
        disabled && s.disabled,
        style,
      ]}
    >
      <Icon name={icon} size={back ? 22 : 19} color={back ? colors.texto : colors.textoSecundario} />
      {badge > 0 ? (
        <View style={s.badge} pointerEvents="none" accessible={false}>
          <Text style={s.badgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      ) : dot ? (
        <View style={s.dot} pointerEvents="none" accessible={false} />
      ) : null}
    </TouchableOpacity>
  );
});

type ButtonProps = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};
export const AppButton = memo(function AppButton({
  label,
  onPress,
  icon,
  variant = "secondary",
  disabled,
  busy,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const { colors } = useTheme();
  const s = useMemo(() => createControlStyles(colors), [colors]);
  const blocked = disabled || busy;
  const trailingIcon = icon?.startsWith("chevron-right");
  const color =
    variant === "primary"
      ? colors.textoSobrePrimaria
      : variant === "danger"
        ? colors.tituloErro
        : colors.textoSecundario;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: !!blocked, busy: !!busy }}
      onPress={onPress}
      disabled={blocked}
      activeOpacity={0.8}
      style={[
        s.button,
        variant === "primary"
          ? s.primary
          : variant === "secondary"
            ? s.secondary
            : null,
        blocked && s.disabled,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={color} />
      ) : icon && !trailingIcon ? (
        <Icon name={icon} size={16} color={color} />
      ) : null}
      <Text
        style={[
          s.buttonText,
          variant === "primary"
            ? s.white
            : variant === "danger"
              ? s.danger
              : s.link,
        ]}
      >
        {label}
      </Text>
      {!busy && icon && trailingIcon && (
        <Icon name={icon} size={16} color={color} />
      )}
    </TouchableOpacity>
  );
});
