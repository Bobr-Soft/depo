import { config as configBase } from '@tamagui/config/v3'
import { createTamagui } from '@tamagui/core'

const config = createTamagui(configBase)

export default config

export type AppConfig = typeof config

declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends AppConfig {}
}
