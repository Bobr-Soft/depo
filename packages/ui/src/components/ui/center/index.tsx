import React from 'react';
import type { VariantProps } from 'tailwind-variants';
import { View } from 'react-native';
import { tv } from 'tailwind-variants';

const centerStyle = tv({
  base: 'justify-center items-center',
});

type ICenterProps = React.ComponentProps<typeof View> &
  VariantProps<typeof centerStyle>;

const Center = React.forwardRef<React.ComponentRef<typeof View>, ICenterProps>(
  function Center({ className, ...props }, ref) {
    return (
      <View
        className={centerStyle({ class: className })}
        {...props}
        ref={ref}
      />
    );
  }
);

Center.displayName = 'Center';

export { Center };
