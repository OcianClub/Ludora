import type { ReactNode } from "react";
import { View } from "react-native";
import type { SharedValue } from "react-native-reanimated";

/** O deslocamento é aplicado uma única vez pelo CategoryPager.
 * Escala/opacidade em cada lista inteira criavam camadas e atualizações
 * adicionais por frame, embora a transição desejada seja um slide horizontal.
 */
export function CategoryPageMotion({
  children,
}: {
  index: number;
  progress: SharedValue<number>;
  origin: SharedValue<number>;
  settling: SharedValue<boolean>;
  children: ReactNode;
}) {
  return <View style={{ flex: 1 }}>{children}</View>;
}
