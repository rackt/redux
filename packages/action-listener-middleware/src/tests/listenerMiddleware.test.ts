import {
  configureStore,
  createAction,
  AnyAction,
  isAnyOf,
} from '@reduxjs/toolkit'
import {
  createActionListenerMiddleware,
  addListenerAction,
  removeListenerAction,
  When,
  ActionListenerMiddlewareAPI,
} from '../index'

const middlewareApi = {
  getState: expect.any(Function),
  dispatch: expect.any(Function),
  currentPhase: expect.stringMatching(/beforeReducer|afterReducer/),
  unsubscribe: expect.any(Function),
}

const noop = () => {}

describe('createActionListenerMiddleware', () => {
  let store = configureStore({
    reducer: () => ({}),
    middleware: [createActionListenerMiddleware()] as const,
  })
  let reducer: jest.Mock
  let middleware: ReturnType<typeof createActionListenerMiddleware>

  const testAction1 = createAction<string>('testAction1')
  type TestAction1 = ReturnType<typeof testAction1>
  const testAction2 = createAction<string>('testAction2')
  type TestAction2 = ReturnType<typeof testAction2>
  const testAction3 = createAction<string>('testAction3')
  type TestAction3 = ReturnType<typeof testAction3>

  beforeEach(() => {
    middleware = createActionListenerMiddleware()
    reducer = jest.fn(() => ({}))
    store = configureStore({
      reducer,
      middleware: [middleware] as const,
    })
  })

  test('directly subscribing', () => {
    const listener = jest.fn((_: TestAction1) => {})

    middleware.addListener(testAction1, listener)

    store.dispatch(testAction1('a'))
    store.dispatch(testAction2('b'))
    store.dispatch(testAction1('c'))

    expect(listener.mock.calls).toEqual([
      [testAction1('a'), middlewareApi],
      [testAction1('c'), middlewareApi],
    ])
  })

  test('can subscribe with a string action type', () => {
    const listener = jest.fn((_: AnyAction) => {})

    store.dispatch(addListenerAction(testAction2.type, listener))

    store.dispatch(testAction2('b'))
    expect(listener.mock.calls).toEqual([[testAction2('b'), middlewareApi]])

    store.dispatch(removeListenerAction(testAction2.type, listener))

    store.dispatch(testAction2('b'))
    expect(listener.mock.calls).toEqual([[testAction2('b'), middlewareApi]])
  })

  test('can subscribe with a matcher function', () => {
    const listener = jest.fn((_: AnyAction) => {})

    const isAction1Or2 = isAnyOf(testAction1, testAction2)

    const unsubscribe = middleware.addListener(isAction1Or2, listener)

    store.dispatch(testAction1('a'))
    store.dispatch(testAction2('b'))
    store.dispatch(testAction3('c'))
    expect(listener.mock.calls).toEqual([
      [testAction1('a'), middlewareApi],
      [testAction2('b'), middlewareApi],
    ])

    unsubscribe()

    store.dispatch(testAction2('b'))
    expect(listener.mock.calls).toEqual([
      [testAction1('a'), middlewareApi],
      [testAction2('b'), middlewareApi],
    ])
  })

  test('subscribing with the same listener will not make it trigger twice (like EventTarget.addEventListener())', () => {
    const listener = jest.fn((_: TestAction1) => {})

    middleware.addListener(testAction1, listener)
    middleware.addListener(testAction1, listener)

    store.dispatch(testAction1('a'))
    store.dispatch(testAction2('b'))
    store.dispatch(testAction1('c'))

    expect(listener.mock.calls).toEqual([
      [testAction1('a'), middlewareApi],
      [testAction1('c'), middlewareApi],
    ])
  })

  test('unsubscribing via callback', () => {
    const listener = jest.fn((_: TestAction1) => {})

    const unsubscribe = middleware.addListener(testAction1, listener)

    store.dispatch(testAction1('a'))
    unsubscribe()
    store.dispatch(testAction2('b'))
    store.dispatch(testAction1('c'))

    expect(listener.mock.calls).toEqual([[testAction1('a'), middlewareApi]])
  })

  test('directly unsubscribing', () => {
    const listener = jest.fn((_: TestAction1) => {})

    middleware.addListener(testAction1, listener)

    store.dispatch(testAction1('a'))

    middleware.removeListener(testAction1, listener)
    store.dispatch(testAction2('b'))
    store.dispatch(testAction1('c'))

    expect(listener.mock.calls).toEqual([[testAction1('a'), middlewareApi]])
  })

  test('unsubscribing without any subscriptions does not trigger an error', () => {
    middleware.removeListener(testAction1, noop)
  })

  test('subscribing via action', () => {
    const listener = jest.fn((_: TestAction1) => {})

    store.dispatch(addListenerAction(testAction1, listener))

    store.dispatch(testAction1('a'))
    store.dispatch(testAction2('b'))
    store.dispatch(testAction1('c'))

    expect(listener.mock.calls).toEqual([
      [testAction1('a'), middlewareApi],
      [testAction1('c'), middlewareApi],
    ])
  })

  test('unsubscribing via callback from dispatch', () => {
    const listener = jest.fn((_: TestAction1) => {})

    const unsubscribe = store.dispatch(addListenerAction(testAction1, listener))

    store.dispatch(testAction1('a'))
    // TODO This return type isn't correct
    // @ts-expect-error
    unsubscribe()
    store.dispatch(testAction2('b'))
    store.dispatch(testAction1('c'))

    expect(listener.mock.calls).toEqual([[testAction1('a'), middlewareApi]])
  })

  test('unsubscribing via action', () => {
    const listener = jest.fn((_: TestAction1) => {})

    middleware.addListener(testAction1, listener)

    store.dispatch(testAction1('a'))

    store.dispatch(removeListenerAction(testAction1, listener))
    store.dispatch(testAction2('b'))
    store.dispatch(testAction1('c'))

    expect(listener.mock.calls).toEqual([[testAction1('a'), middlewareApi]])
  })

  const unforwaredActions: [string, AnyAction][] = [
    ['addListenerAction', addListenerAction(testAction1, noop)],
    ['removeListenerAction', removeListenerAction(testAction1, noop)],
  ]
  test.each(unforwaredActions)(
    '"%s" is not forwarded to the reducer',
    (_, action) => {
      reducer.mockClear()

      store.dispatch(testAction1('a'))
      store.dispatch(action)
      store.dispatch(testAction2('b'))

      expect(reducer.mock.calls).toEqual([
        [{}, testAction1('a')],
        [{}, testAction2('b')],
      ])
    }
  )

  test('"can unsubscribe via middleware api', () => {
    const listener = jest.fn(
      (
        action: TestAction1,
        api: ActionListenerMiddlewareAPI<any, any, any>
      ) => {
        if (action.payload === 'b') {
          api.unsubscribe()
        }
      }
    )

    middleware.addListener(testAction1, listener)

    store.dispatch(testAction1('a'))
    store.dispatch(testAction1('b'))
    store.dispatch(testAction1('c'))

    expect(listener.mock.calls).toEqual([
      [testAction1('a'), middlewareApi],
      [testAction1('b'), middlewareApi],
    ])
  })

  const whenMap: [When, string, string, number][] = [
    [undefined, 'reducer', 'listener', 1],
    ['beforeReducer', 'listener', 'reducer', 1],
    ['afterReducer', 'reducer', 'listener', 1],
    ['both', 'reducer', 'listener', 2],
  ]
  test.each(whenMap)(
    'with "when" set to %s, %s runs before %s',
    (when, _, shouldRunLast, listenerCalls) => {
      let whoRanLast = ''

      reducer.mockClear()
      reducer.mockImplementationOnce(() => {
        whoRanLast = 'reducer'
      })
      const listener = jest.fn(() => {
        whoRanLast = 'listener'
      })

      middleware.addListener(testAction1, listener, when ? { when } : {})

      store.dispatch(testAction1('a'))
      expect(reducer).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledTimes(listenerCalls)
      expect(whoRanLast).toBe(shouldRunLast)
    }
  )

  test('mixing "before" and "after"', () => {
    const calls: Function[] = []
    function before1() {
      calls.push(before1)
    }
    function before2() {
      calls.push(before2)
    }
    function after1() {
      calls.push(after1)
    }
    function after2() {
      calls.push(after2)
    }

    middleware.addListener(testAction1, before1, { when: 'beforeReducer' })
    middleware.addListener(testAction1, before2, { when: 'beforeReducer' })
    middleware.addListener(testAction1, after1, { when: 'afterReducer' })
    middleware.addListener(testAction1, after2, { when: 'afterReducer' })

    store.dispatch(testAction1('a'))
    store.dispatch(testAction2('a'))

    expect(calls).toEqual([before1, before2, after1, after2])
  })

  test('by default, actions are forwarded to the store', () => {
    reducer.mockClear()

    const listener = jest.fn((_: TestAction1) => {})

    middleware.addListener(testAction1, listener)

    store.dispatch(testAction1('a'))

    expect(reducer.mock.calls).toEqual([[{}, testAction1('a')]])
  })

  test('Continues running other listeners if there is an error', () => {
    const matcher = (action: any) => true

    middleware.addListener(matcher, () => {
      throw new Error('Panic!')
    })

    const listener = jest.fn(() => {})
    middleware.addListener(matcher, listener)

    store.dispatch(testAction1('a'))
    expect(listener.mock.calls).toEqual([[testAction1('a'), middlewareApi]])
  })
})
