import React from 'react';
import { ColorValue, Text, TextProps, TextStyle } from 'react-native';
import { colors, type, TypeVariant } from '../theme/theme';

type Props = TextProps & {
  variant?: TypeVariant;
  color?: ColorValue;
  center?: boolean;
  style?: TextStyle | TextStyle[] | (TextStyle | false | undefined)[];
};

function AppText({ variant = 'body', color = colors.ink, center, style, children, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[type[variant], { color }, center && { textAlign: 'center' }, style]}>
      {children}
    </Text>
  );
}

export default AppText;
