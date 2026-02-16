'use client';
import React, { createContext, useContext } from 'react';
import { createButton } from '@gluestack-ui/button';
import { cssInterop } from 'nativewind';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { PrimitiveIcon, UIIcon } from '@gluestack-ui/icon';
import { cn } from '../../../utils/cn';

const SCOPE = 'BUTTON';

// Style context implementation
const ParentContext = createContext<Record<string, any>>({});
const useParentContext = () => useContext(ParentContext) as any;

type WithStyleContextProps = { context?: any };

const withStyleContext = <T extends React.ComponentType<any>>(
  Component: T,
  scope: string = 'Global'
) => {
  return React.forwardRef(({ context, ...props }: any, ref: any) => {
    const parentContextValues = useParentContext();
    const contextValues = { ...parentContextValues, [scope]: context };
    return (
      <ParentContext.Provider value={contextValues}>
        <Component {...props} ref={ref} />
      </ParentContext.Provider>
    );
  }) as React.ForwardRefExoticComponent<
    React.ComponentPropsWithoutRef<T> &
      WithStyleContextProps &
      React.RefAttributes<T>
  >;
};

const useStyleContext = (scope: string = 'Global') => {
  const parentContextValues = useParentContext();
  return parentContextValues[scope] ?? {};
};

const Root = withStyleContext(Pressable, SCOPE);

const UIButton = createButton({
  Root: Root,
  Text,
  Group: View,
  Spinner: ActivityIndicator,
  Icon: UIIcon,
});

cssInterop(Root, { className: 'style' });
cssInterop(Text, { className: 'style' });
cssInterop(View, { className: 'style' });
cssInterop(ActivityIndicator, { className: 'style' });

cssInterop(PrimitiveIcon, {
  className: {
    target: 'style',
    nativeStyleToProp: {
      height: true,
      width: true,
      fill: true,
      color: 'classNameColor',
      stroke: true,
    },
  },
});

// Helper function to build button className based on props
const getButtonClassName = (
  variant: 'solid' | 'outline' | 'link' = 'solid',
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md',
  action: 'primary' | 'secondary' | 'positive' | 'negative' | 'default' = 'primary',
  className?: string
) => {
  const classes = [
    'group/button rounded flex-row items-center justify-center gap-2',
  ];

  // Size classes
  if (size === 'xs') classes.push('px-3.5 h-8');
  else if (size === 'sm') classes.push('px-4 h-9');
  else if (size === 'md') classes.push('px-5 h-10');
  else if (size === 'lg') classes.push('px-6 h-11');
  else if (size === 'xl') classes.push('px-7 h-12');

  // Variant + Action base styles
  if (variant === 'solid') {
    if (action === 'primary') classes.push('bg-primary-500');
    else if (action === 'secondary') classes.push('bg-secondary-500');
    else if (action === 'positive') classes.push('bg-success-500');
    else if (action === 'negative') classes.push('bg-error-500');
    else classes.push('bg-transparent');
  } else if (variant === 'outline') {
    classes.push('bg-transparent border');
    if (action === 'primary') classes.push('border-primary-300');
    else if (action === 'secondary') classes.push('border-secondary-300');
    else if (action === 'positive') classes.push('border-success-300');
    else if (action === 'negative') classes.push('border-error-300');
  } else if (variant === 'link') {
    classes.push('px-0 bg-transparent');
  }

  return cn(classes.join(' '), className);
};

// Helper function to build button text className based on props
const getButtonTextClassName = (
  variant: 'solid' | 'outline' | 'link' = 'solid',
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md',
  action: 'primary' | 'secondary' | 'positive' | 'negative' | 'default' = 'primary',
  className?: string
) => {
  const classes = ['font-semibold'];

  // Size
  if (size === 'xs') classes.push('text-xs');
  else if (size === 'sm') classes.push('text-sm');
  else if (size === 'md') classes.push('text-base');
  else if (size === 'lg') classes.push('text-lg');
  else if (size === 'xl') classes.push('text-xl');

  // Color based on variant + action
  if (variant === 'solid') {
    if (action === 'secondary') classes.push('text-typography-800');
    else classes.push('text-typography-0');
  } else if (variant === 'outline' || variant === 'link') {
    if (action === 'primary') classes.push('text-primary-500');
    else if (action === 'secondary') classes.push('text-typography-500');
    else if (action === 'positive') classes.push('text-success-600');
    else if (action === 'negative') classes.push('text-error-600');
    else classes.push('text-primary-600');
  }

  return cn(classes.join(' '), className);
};

// Helper function for button icon className
const getButtonIconClassName = (
  variant: 'solid' | 'outline' | 'link' = 'solid',
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md',
  action: 'primary' | 'secondary' | 'positive' | 'negative' | 'default' = 'primary',
  className?: string
) => {
  const classes = ['fill-none'];

  // Size
  if (size === 'xs') classes.push('h-3.5 w-3.5');
  else if (size === 'sm') classes.push('h-4 w-4');
  else if (size === 'md') classes.push('h-[18px] w-[18px]');
  else if (size === 'lg') classes.push('h-[18px] w-[18px]');
  else if (size === 'xl') classes.push('h-5 w-5');

  // Color based on variant + action
  if (variant === 'solid') {
    if (action === 'secondary') classes.push('text-typography-800');
    else classes.push('text-typography-0');
  } else {
    if (action === 'primary') classes.push('text-primary-600');
    else if (action === 'secondary') classes.push('text-typography-500');
    else if (action === 'positive') classes.push('text-success-600');
    else if (action === 'negative') classes.push('text-error-600');
  }

  return cn(classes.join(' '), className);
};

type ButtonVariant = 'solid' | 'outline' | 'link';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type ButtonAction = 'primary' | 'secondary' | 'positive' | 'negative' | 'default';

type IButtonProps = Omit<
  React.ComponentPropsWithoutRef<typeof UIButton>,
  'context'
> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  action?: ButtonAction;
  className?: string;
};

const Button = React.forwardRef<
  React.ElementRef<typeof UIButton>,
  IButtonProps
>(
  (
    { className, variant = 'solid', size = 'md', action = 'primary', ...props },
    ref
  ) => {
    return (
      <UIButton
        ref={ref}
        {...props}
        className={getButtonClassName(variant, size, action, className)}
        context={{ variant, size, action }}
      />
    );
  }
);

type IButtonTextProps = React.ComponentPropsWithoutRef<typeof UIButton.Text> & {
  className?: string;
};

const ButtonText = React.forwardRef<
  React.ElementRef<typeof UIButton.Text>,
  IButtonTextProps
>(({ className, ...props }, ref) => {
  const {
    variant = 'solid',
    size = 'md',
    action = 'primary',
  } = useStyleContext(SCOPE);

  return (
    <UIButton.Text
      ref={ref}
      {...props}
      className={getButtonTextClassName(variant, size, action, className)}
    />
  );
});

const ButtonSpinner = UIButton.Spinner;

type IButtonIcon = React.ComponentPropsWithoutRef<typeof UIButton.Icon> & {
  className?: string | undefined;
  as?: React.ElementType;
  height?: number;
  width?: number;
  size?: ButtonSize;
};

const ButtonIcon = React.forwardRef<
  React.ElementRef<typeof UIButton.Icon>,
  IButtonIcon
>(({ className, size, ...props }, ref) => {
  const {
    variant = 'solid',
    size: parentSize = 'md',
    action = 'primary',
  } = useStyleContext(SCOPE);

  const effectiveSize = size || parentSize;

  if (typeof effectiveSize === 'number') {
    return (
      <UIButton.Icon
        ref={ref}
        {...props}
        className={cn('fill-none', className)}
        size={effectiveSize}
      />
    );
  } else if (
    (props.height !== undefined || props.width !== undefined) &&
    size === undefined
  ) {
    return (
      <UIButton.Icon
        ref={ref}
        {...props}
        className={cn('fill-none', className)}
      />
    );
  }
  return (
    <UIButton.Icon
      {...props}
      className={getButtonIconClassName(variant, effectiveSize, action, className)}
      ref={ref}
    />
  );
});

type IButtonGroupProps = React.ComponentPropsWithoutRef<typeof UIButton.Group> & {
  space?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  isAttached?: boolean;
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  className?: string;
};

const ButtonGroup = React.forwardRef<
  React.ElementRef<typeof UIButton.Group>,
  IButtonGroupProps
>(
  (
    {
      className,
      space = 'md',
      isAttached = false,
      flexDirection = 'column',
      ...props
    },
    ref
  ) => {
    const classes = [];

    // Space classes
    if (!isAttached) {
      if (space === 'xs') classes.push('gap-1');
      else if (space === 'sm') classes.push('gap-2');
      else if (space === 'md') classes.push('gap-3');
      else if (space === 'lg') classes.push('gap-4');
      else if (space === 'xl') classes.push('gap-5');
      else if (space === '2xl') classes.push('gap-6');
      else if (space === '3xl') classes.push('gap-7');
      else if (space === '4xl') classes.push('gap-8');
    } else {
      classes.push('gap-0');
    }

    // Flex direction
    if (flexDirection === 'row') classes.push('flex-row');
    else if (flexDirection === 'column') classes.push('flex-col');
    else if (flexDirection === 'row-reverse') classes.push('flex-row-reverse');
    else if (flexDirection === 'column-reverse') classes.push('flex-col-reverse');

    return (
      <UIButton.Group
        className={cn(classes.join(' '), className)}
        {...props}
        ref={ref}
      />
    );
  }
);

Button.displayName = 'Button';
ButtonText.displayName = 'ButtonText';
ButtonSpinner.displayName = 'ButtonSpinner';
ButtonIcon.displayName = 'ButtonIcon';
ButtonGroup.displayName = 'ButtonGroup';

export { Button, ButtonText, ButtonSpinner, ButtonIcon, ButtonGroup };
