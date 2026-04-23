/**
 * Simple module-level store for communicating inbound item edits
 * from the edit screen back to the inbound screen via useFocusEffect.
 * Avoids router stack pollution from URL-param-based communication.
 */

export type InboundPendingAction =
  | { type: "update"; code: string; quantity: number }
  | { type: "delete"; code: string };

let pendingAction: InboundPendingAction | null = null;

export function setPendingInboundAction(action: InboundPendingAction) {
  pendingAction = action;
}

export function consumePendingInboundAction(): InboundPendingAction | null {
  const action = pendingAction;
  pendingAction = null;
  return action;
}
