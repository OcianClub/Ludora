import Svg, { Circle, Path } from "react-native-svg";

export function SinalAoVivo({
  size = 18,
  color = "#F43D60",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d="M5 5a10 10 0 0 0 0 14m14-14a10 10 0 0 1 0 14M8 8a6 6 0 0 0 0 8m8-8a6 6 0 0 1 0 8"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={12} r={2} fill={color} />
    </Svg>
  );
}
