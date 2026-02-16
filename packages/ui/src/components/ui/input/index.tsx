'use client';
import React from 'react';
import { View, TextInput, TextInputProps } from 'react-native';
import { cssInterop } from 'nativewind';
import { cn } from '../../../utils/cn';

// Setup cssInterop for styling
cssInterop(View, { className: 'style' });
cssInterop(TextInput, { className: 'style' });

type InputSize = 'sm' | 'md' | 'lg' | 'xl';
type InputVariant = 'outline' | 'underlined' | 'rounded';

type IInputProps = React.ComponentProps<typeof View> & {
  size?: InputSize;
  variant?: InputVariant;
  isDisabled?: boolean;
  isInvalid?: boolean;
  className?: string;
};

const Input = React.forwardRef<React.ComponentRef<typeof View>, IInputProps>(
  function Input({ className, size = 'md', variant = 'outline', isDisabled, isInvalid, ...props }, ref) {
    const sizeClasses: Record<InputSize, string> = {
      sm: 'h-9',
      md: 'h-10',
      lg: 'h-11',
      xl: 'h-12',
    };

    const variantClasses: Record<InputVariant, string> = {
      outline: 'border border-outline-300 rounded',
      underlined: 'border-b border-outline-300',
      rounded: 'border border-outline-300 rounded-full',
    };

    return (
      <View
        ref={ref}
        className={cn(
          'flex-row items-center px-3',
          sizeClasses[size],
          variantClasses[variant],
          isDisabled && 'opacity-40',
          isInvalid && 'border-error-500',
          className
        )}
        {...props}
      />
    );
  }
);

type IInputFieldProps = TextInputProps & {
  className?: string;
};

const InputField = React.forwardRef<
  React.ComponentRef<typeof TextInput>,
  IInputFieldProps
>(function InputField({ className, ...props }, ref) {
  return (
    <TextInput
      ref={ref}
      className={cn('flex-1 text-typography-900', className)}
      placeholderTextColor="#999"
      {...props}
    />
  );
});

Input.displayName = 'Input';
InputField.displayName = 'InputField';

export { Input, InputField };

