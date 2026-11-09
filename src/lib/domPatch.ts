/**
 * Make React resilient to third-party DOM mutations (Google Translate, Grammarly,
 * other extensions). Translate wraps text nodes in <font> elements, so when React
 * later calls removeChild/insertBefore with its original node, the browser throws
 * "NotFoundError: Failed to execute 'removeChild' on 'Node'". We turn those into
 * warnings instead of crashing the tree into the ErrorBoundary.
 *
 * See https://github.com/facebook/react/issues/11538#issuecomment-417504600
 */
export function patchDomForExternalMutations(): void {
  if (typeof Node !== 'function' || !Node.prototype) return;

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      console.warn('[domPatch] removeChild: node is not a child of this parent (likely modified by an extension/translate)', child, this);
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      console.warn('[domPatch] insertBefore: reference node is not a child of this parent (likely modified by an extension/translate)', referenceNode, this);
      return newNode;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}
