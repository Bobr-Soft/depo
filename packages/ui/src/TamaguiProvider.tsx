import { TamaguiProvider as TamaguiProviderOg } from '@tamagui/core'
import { ReactNode } from 'react'
import config from '../tamagui.config'

export function TamaguiProvider({ children }: { children: ReactNode }) {
  return (
    <TamaguiProviderOg config={config} defaultTheme="dark">
      {children}
    </TamaguiProviderOg>
  )
}
