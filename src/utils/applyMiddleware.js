import compose from './compose';

/**
 * Creates a higher-order store that applies middleware to the dispatch method
 * of the Redux store. This is handy for a variety of tasks, such as expressing
 * asynchronous actions in a concise manner, or logging every action payload.
 *
 * See `redux-thunk` package as an example of the Redux middleware.
 *
 * Because middleware is potentially asynchronous, this should be the first
 * higher-order store in the composition chain.
 *
 * @param {...Function} middlewares The middleware chain to be applied.
 * @returns {Function} A higher-order store.
 */
export default function applyMiddleware(...middlewares) {
  return (next) => (reducer, initialState) => {
    var store = next(reducer, initialState);
    var dispatch = store.dispatch;
    var chain = [];

    var middlewareAPI = {
      getState: store.getState,
      dispatch: (action) => dispatch(action)
    };
    chain = middlewares.map(middleware => middleware(middlewareAPI));
    dispatch = compose(...chain, store.dispatch);

    return {
      ...store,
      dispatch
    };
  };
}
