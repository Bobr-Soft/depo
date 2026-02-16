import React from 'react';
import type { VariantProps } from 'tailwind-variants';
import { View } from 'react-native';
import { boxStyle } from './styles';

type IBoxProps = React.ComponentProps<typeof View> &
  VariantProps<typeof boxStyle>;

const Box = React.forwardRef<React.ComponentRef<typeof View>, IBoxProps>(
  function Box({ className, ...props }, ref) {
    return (
      <View
        className={boxStyle({ class: className })}
        {...props}
        ref={ref}
      />
    );
  }
);

Box.displayName = 'Box';

export { Box };
