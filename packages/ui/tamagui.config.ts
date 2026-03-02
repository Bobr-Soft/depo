import { config as configBase } from '@tamagui/config/v3'
import { createTamagui } from '@tamagui/core'

const config = createTamagui({
  ...configBase,
  themes: {
    ...configBase.themes,
    dark: {
      ...configBase.themes.dark,
      background: '#0B0D10',
      color9: '#6F7782',
      color10: '#8993A1',
      color11: '#B7C0CC',
      color12: '#F5F7FA',
      color: '#F5F7FA',
      gray1: '#111418',
      gray2: '#161A1F',
      gray3: '#1B2026',
      gray4: '#212730',
      gray5: '#29303A',
      gray6: '#323A45',
      gray7: '#3E4754',
      gray8: '#4C5766',
      gray9: '#5E6A7B',
      gray10: '#748296',
      gray11: '#9AA8BA',
      gray12: '#E6EBF2',
      shadowColor: 'rgba(0,0,0,0.45)',
    },
    light: {
      ...configBase.themes.light,
      background: '#FAFBFC',
      color9: '#7A7F87',
      color10: '#626A75',
      color11: '#4E5663',
      color12: '#131821',
      color: '#131821',
      gray1: '#FCFCFD',
      gray2: '#F7F8FA',
      gray3: '#F0F2F5',
      gray4: '#E8EBEF',
      gray5: '#E0E4EA',
      gray6: '#D5DAE2',
      gray7: '#C5CCD7',
      gray8: '#AEB7C5',
      gray9: '#8A95A6',
      gray10: '#757F90',
      gray11: '#5C6778',
      gray12: '#121A25',
      shadowColor: 'rgba(7,10,15,0.14)',
    },
  },
})

export default config

export type AppConfig = typeof config

declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends AppConfig {}
}
