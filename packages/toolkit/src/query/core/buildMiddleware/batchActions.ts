import type { QueryThunk, RejectedAction } from '../buildThunks'
import type { SubMiddlewareBuilder } from './types'

// Copied from https://github.com/feross/queue-microtask
let promise: Promise<any>
const queueMicrotaskShim =
  typeof queueMicrotask === 'function'
    ? queueMicrotask.bind(typeof window !== 'undefined' ? window : global)
    : // reuse resolved promise, and allocate it lazily
      (cb: () => void) =>
        (promise || (promise = Promise.resolve())).then(cb).catch((err: any) =>
          setTimeout(() => {
            throw err
          }, 0)
        )

export const build: SubMiddlewareBuilder = ({
  api,
  context: { apiUid },
  queryThunk,
  reducerPath,
}) => {
  return (mwApi) => {
    let abortedQueryActionsQueue: RejectedAction<QueryThunk, any>[] = []
    let dispatchQueued = false

    return (next) => (action) => {
      if (queryThunk.rejected.match(action)) {
        const { condition, arg } = action.meta

        if (condition && arg.subscribe) {
          // request was aborted due to condition (another query already running)
          // _Don't_ dispatch right away - queue it for a debounced grouped dispatch
          abortedQueryActionsQueue.push(action)

          if (!dispatchQueued) {
            queueMicrotaskShim(() => {
              mwApi.dispatch(
                api.internalActions.subscriptionRequestsRejected(
                  abortedQueryActionsQueue
                )
              )
              abortedQueryActionsQueue = []
            })
            dispatchQueued = true
          }
          // _Don't_ let the action reach the reducers now!
          return
        }
      }

      const result = next(action)

      return result
    }
  }
}
