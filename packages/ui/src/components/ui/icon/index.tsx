'use client';
import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { cn } from '../../../utils/cn';

type IconProps = React.ComponentProps<typeof View> & {
  size?: number;
  color?: string;
  className?: string;
};

// Base Icon wrapper
const Icon = React.forwardRef<React.ComponentRef<typeof View>, IconProps>(
  function Icon({ size = 24, color = 'currentColor', className, children, ...props }, ref) {
    return (
      <View
        ref={ref}
        className={cn('', className)}
        style={{ width: size, height: size }}
        {...props}
      >
        {children}
      </View>
    );
  }
);

// AddIcon (Plus)
const AddIcon = React.forwardRef<any, IconProps>(
  function AddIcon({ size = 24, color = 'currentColor', className, ...props }, ref) {
    return (
      <View
        ref={ref}
        className={cn('', className)}
        style={{ width: size, height: size }}
        {...props}
      >
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 5v14M5 12h14"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      </View>
    );
  }
);

// InfoIcon
const InfoIcon = React.forwardRef<any, IconProps>(
  function InfoIcon({ size = 24, color = 'currentColor', className, ...props }, ref) {
    return (
      <View
        ref={ref}
        className={cn('', className)}
        style={{ width: size, height: size }}
        {...props}
      >
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={2} />
          <Path
            d="M12 16v-4M12 8h.01"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      </View>
    );
  }
);

// ArrowUpIcon
const ArrowUpIcon = React.forwardRef<any, IconProps>(
  function ArrowUpIcon({ size = 24, color = 'currentColor', className, ...props }, ref) {
    return (
      <View
        ref={ref}
        className={cn('', className)}
        style={{ width: size, height: size }}
        {...props}
      >
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 19V5M5 12l7-7 7 7"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    );
  }
);

// ThreeDotsIcon (MoreVertical)
const ThreeDotsIcon = React.forwardRef<any, IconProps>(
  function ThreeDotsIcon({ size = 24, color = 'currentColor', className, ...props }, ref) {
    return (
      <View
        ref={ref}
        className={cn('', className)}
        style={{ width: size, height: size }}
        {...props}
      >
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="5" r="1.5" fill={color} />
          <Circle cx="12" cy="12" r="1.5" fill={color} />
          <Circle cx="12" cy="19" r="1.5" fill={color} />
        </Svg>
      </View>
    );
  }
);

Icon.displayName = 'Icon';
AddIcon.displayName = 'AddIcon';
InfoIcon.displayName = 'InfoIcon';
ArrowUpIcon.displayName = 'ArrowUpIcon';
ThreeDotsIcon.displayName = 'ThreeDotsIcon';

export { Icon, AddIcon, InfoIcon, ArrowUpIcon, ThreeDotsIcon };

