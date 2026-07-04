'use client';

import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';

const UNDO_WINDOW_MS = 5000;

interface UndoableDeleteOptions<T> {
  /** Query key of the cached list the item is optimistically removed from. */
  queryKey: QueryKey;
  getId: (item: T) => string;
  /** The actual server delete, only called once the undo window closes. */
  deleteFn: (item: T) => Promise<unknown>;
  /** Additional query keys to invalidate after the delete commits. */
  invalidateKeys?: QueryKey[];
  /** Lowercase noun for toast copy, e.g. "debt", "payment". */
  entityLabel: string;
}

/**
 * Delete with an undo snackbar. The item is removed from the query cache
 * immediately, but the server delete is deferred until the toast closes —
 * so Undo is lossless (nothing was actually deleted yet).
 */
export function useUndoableDelete<T>({
  queryKey,
  getId,
  deleteFn,
  invalidateKeys = [],
  entityLabel,
}: UndoableDeleteOptions<T>) {
  const queryClient = useQueryClient();

  function deleteWithUndo(item: T, options?: { description?: string; onCommitted?: () => void }) {
    const id = getId(item);

    queryClient.setQueryData<T[]>(queryKey, (old) =>
      old?.filter((existing) => getId(existing) !== id)
    );

    // The toast can report closure through both onAutoClose and onDismiss;
    // this guard makes commit/undo mutually exclusive and single-fire.
    let settled = false;

    async function commit() {
      if (settled) return;
      settled = true;
      try {
        await deleteFn(item);
        options?.onCommitted?.();
      } catch {
        toast.error(`Failed to delete ${entityLabel}`);
      } finally {
        for (const key of [queryKey, ...invalidateKeys]) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      }
    }

    function undo() {
      if (settled) return;
      settled = true;
      // Nothing was deleted server-side; refetching restores the cache.
      queryClient.invalidateQueries({ queryKey });
    }

    toast(`${entityLabel.charAt(0).toUpperCase()}${entityLabel.slice(1)} deleted`, {
      description: options?.description,
      duration: UNDO_WINDOW_MS,
      action: {
        label: 'Undo',
        onClick: undo,
      },
      onAutoClose: () => void commit(),
      onDismiss: () => void commit(),
    });
  }

  return { deleteWithUndo };
}
