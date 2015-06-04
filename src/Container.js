import { Component, PropTypes } from 'react';
import invariant from 'invariant';
import isFunction from 'lodash/lang/isFunction';
import isPlainObject from 'lodash/lang/isPlainObject';
import mapValues from 'lodash/object/mapValues';
import values from 'lodash/object/values';

export default class ReduxContainer extends Component {
  static contextTypes = {
    redux: PropTypes.object.isRequired
  };

  static propTypes = {
    children: PropTypes.func.isRequired,
    actions: PropTypes.object.isRequired,
    stores: PropTypes.object.isRequired
  }

  static defaultProps = {
    stores: {},
    actions: {}
  };

  constructor(props, context) {
    super(props, context);
    this.handleChange = this.handleChange.bind(this);
    this.update(props);
  }

  componentWillReceiveProps(nextProps) {
    this.update(nextProps);
  }

  componentWillUnmount() {
    this.unsubscribe();
  }

  update(props) {
    const { stores, actions } = props;

    invariant(
      isPlainObject(actions) && values(actions).every(isFunction),
      '"actions" must be a plain object with functions as values. Did you misspell an import?'
    );

    invariant(
      isPlainObject(stores) && values(stores).every(isFunction),
      '"stores" must be a plain object with functions as values. Did you misspell an import?'
    );

    const { wrapActionCreator, observeStores } = this.context.redux;
    this.actions = mapValues(props.actions, wrapActionCreator);

    if (this.unsubscribe) {
      this.unsubscribe();
    }

    this.unsubscribe = observeStores(values(stores), this.handleChange);
  }

  mapState(stateFromStores) {
    const { getStoreKey } = this.context.redux;
    return mapValues(this.props.stores, store =>
      stateFromStores[getStoreKey(store)]
    );
  }

  handleChange(stateFromStores) {
    const nextState = this.mapState(stateFromStores);
    if (this.state) {
      this.setState(nextState);
    } else {
      this.state = nextState;
    }
  }

  render() {
    return this.props.children({
      state: this.state,
      actions: this.actions
    });
  }
}
