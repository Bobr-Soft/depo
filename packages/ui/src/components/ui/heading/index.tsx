import React from 'react';
import { Text as RNText } from 'react-native';
import { cn } from '../../../utils/cn';

type IHeadingProps = React.ComponentProps<typeof RNText> & {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  className?: string;
};

const Heading = React.forwardRef<React.ComponentRef<typeof RNText>, IHeadingProps>(
  function Heading({ className, size = 'lg', ...props }, ref) {
    const sizeClasses = {
      xs: 'text-lg',
      sm: 'text-xl',
      md: 'text-2xl',
      lg: 'text-3xl',
      xl: 'text-4xl',
      '2xl': 'text-5xl',
      '3xl': 'text-6xl',
      '4xl': 'text-7xl',
      '5xl': 'text-8xl',
    };

    return (
      <RNText
        className={cn('font-bold text-typography-900', sizeClasses[size], className)}
        {...props}
        ref={ref}
      />
    );
  }
);

Heading.displayName = 'Heading';

export { Heading };
