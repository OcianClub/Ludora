import type { SvgProps } from 'react-native-svg';

export type LudoraIconProps = Omit<
    SvgProps,
    'width' | 'height' | 'color'
> & {
    size?: number;
    color?: string;
    accessibilityLabel?: string;
}