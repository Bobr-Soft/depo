export type WarehouseMapMode = "status" | "type" | "structure";

export interface WarehouseMapShelfVisual {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  badgeColor: string;
}

export const warehouseMapTokens = {
  surface: "$color2",
  elevatedSurface: "$color3",
  borderMuted: "$color4",
  borderStrong: "$color6",
  selectedBorder: "$yellow8",
  selectedGlow: "$yellow3",
  rowHeaderSurface: "$blue2",
  rowHeaderBorder: "$blue6",
  legendText: "$color11",
  heroText: "$color12",
  heroSubtleText: "$color10",
};

export function getWarehouseMapModeLabel(mode: WarehouseMapMode): string {
  switch (mode) {
    case "status":
      return "Allapot";
    case "type":
      return "Tipus";
    default:
      return "Struktura";
  }
}

export function getWarehouseMapShelfVisual(
  mode: WarehouseMapMode,
  isActive: boolean,
  isXl: boolean
): WarehouseMapShelfVisual {
  if (mode === "type") {
    if (isXl) {
      return {
        backgroundColor: "$orange5",
        borderColor: "$orange8",
        textColor: "$orange12",
        badgeColor: "$orange10",
      };
    }

    return {
      backgroundColor: "$blue5",
      borderColor: "$blue8",
      textColor: "$blue12",
      badgeColor: "$blue10",
    };
  }

  if (mode === "structure") {
    return {
      backgroundColor: "$color4",
      borderColor: "$color8",
      textColor: "$color12",
      badgeColor: "$color10",
    };
  }

  if (!isActive) {
    return {
      backgroundColor: "$color3",
      borderColor: "$red8",
      textColor: "$red11",
      badgeColor: "$red10",
    };
  }

  return {
    backgroundColor: "$green5",
    borderColor: "$green8",
    textColor: "$green12",
    badgeColor: "$green10",
  };
}
